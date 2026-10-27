// Batch VLM verification of the 120 image questions from the Primary Maths bank.
// Reads /tmp/docx-extract/vlm-tasks.json, writes /tmp/docx-extract/vlm-out/q{num}.json
// Concurrency 5, one retry per task.
import ZAI from "z-ai-web-dev-sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const TASKS = JSON.parse(readFileSync("/tmp/docx-extract/vlm-tasks.json", "utf8"));
const OUT_DIR = "/tmp/docx-extract/vlm-out";
mkdirSync(OUT_DIR, { recursive: true });

const CONCURRENCY = 1;
const INTER_CALL_DELAY_MS = 2500;

async function runOne(zai, task, attempt = 0) {
  const outPath = `${OUT_DIR}/q${task.num}.json`;
  if (existsSync(outPath)) return { num: task.num, status: "cached" };
  const b64 = readFileSync(task.image).toString("base64");
  try {
    const res = await zai.chat.completions.createVision({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: task.prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        },
      ],
      thinking: { type: "disabled" },
    });
    const content = res.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new Error("empty response");
    writeFileSync(outPath, JSON.stringify({ num: task.num, content }, null, 1));
    return { num: task.num, status: "ok" };
  } catch (e) {
    if (attempt < 3) {
      const backoff = 4000 * (attempt + 1) + Math.random() * 2000;
      await new Promise((r) => setTimeout(r, backoff));
      return runOne(zai, task, attempt + 1);
    }
    return { num: task.num, status: `failed: ${e.message}` };
  }
}

async function main() {
  const zai = await ZAI.create();
  const queue = [...TASKS];
  const results = [];
  let sinceDelay = 0;
  async function worker() {
    while (queue.length) {
      const task = queue.shift();
      if (sinceDelay >= 4) {
        await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
        sinceDelay = 0;
      }
      sinceDelay++;
      const r = await runOne(zai, task);
      results.push(r);
      if (r.status !== "ok" && r.status !== "cached") console.error(JSON.stringify(r));
      if (results.length % 20 === 0) console.log(`progress: ${results.length}/${TASKS.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const failed = results.filter((r) => r.status.startsWith("failed"));
  console.log(`\nDone. ok=${results.filter((r) => r.status === "ok").length}, cached=${results.filter((r) => r.status === "cached").length}, failed=${failed.length}`);
  if (failed.length) console.log(JSON.stringify(failed, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
