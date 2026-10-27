// Batch VLM verification, v2: multiple images per request to survive rate limits.
// Groups the remaining tasks into chunks of 4, sends one multi-image vision call
// per chunk, parses per-question DESCRIPTION/VERDICT blocks.
// Skips questions that already have output files. Idempotent.
import ZAI from "z-ai-web-dev-sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";

const TASKS = JSON.parse(readFileSync("/tmp/docx-extract/vlm-tasks.json", "utf8"));
const OUT_DIR = "/tmp/docx-extract/vlm-out";
mkdirSync(OUT_DIR, { recursive: true });

const CHUNK = 4;
const PACE_MS = 9000;
const MAX_RETRY = 5;

const done = new Set(readdirSync(OUT_DIR).map((f) => f.replace("q", "").replace(".json", "")));
const remaining = TASKS.filter((t) => !done.has(String(t.num)));
console.log(`already done: ${done.size}, remaining: ${remaining.length}`);

const chunks = [];
for (let i = 0; i < remaining.length; i += CHUNK) chunks.push(remaining.slice(i, i + CHUNK));

function buildPrompt(chunk) {
  const parts = chunk.map((t, i) => {
    const opts = t.options.map((o, j) => `${"ABCD"[j]}) ${o}`).join("  ");
    return [
      `### IMAGE ${i + 1} (Question ${t.num})`,
      `Topic: ${t.topic} (Primary ${t.level})`,
      `Question: ${t.stem}`,
      `Options: ${opts}`,
      `Answer key: ${t.answerLetter}) ${t.options["ABCD".indexOf(t.answerLetter)]}`,
    ].join("\n");
  });
  return (
    "You are verifying primary-school mathematics question images. You will receive " +
    `${chunk.length} images, in the order given below. For EACH image, answer with this exact format:\n` +
    `Q<num>\nDESCRIPTION: <one short sentence describing exactly what the image shows — for shape/clock/angle/line questions name what is drawn; for labelled diagrams state the labelled numbers>\n` +
    `VERDICT: <AGREES | DISAGREES | UNSURE> — <one short reason>\n\n` +
    "Judge only from what the image actually shows. Clocks: read hour and minute hands carefully. " +
    "Labelled rectangles: state the length and width. Labelled triangles: state base and height. " +
    "Grids: state the coordinates of the marked point, watching for negative axes.\n\n" +
    parts.join("\n\n")
  );
}

function parseResponse(text, chunk) {
  const out = {};
  for (const t of chunk) {
    const re = new RegExp(`Q${t.num}\\b[\\s\\S]*?(?=Q\\d+\\b|$)`, "i");
    const m = text.match(re);
    if (!m) continue;
    const block = m[0];
    const d = block.match(/DESCRIPTION:\s*([\s\S]*?)(?=VERDICT:|$)/i);
    const v = block.match(/VERDICT:\s*([^\n]*)/i);
    out[t.num] = {
      num: t.num,
      description: d ? d[1].trim() : "",
      verdict: v ? v[1].trim() : "",
    };
  }
  // fallback: model may have labelled by IMAGE 1..N instead of question number
  if (Object.keys(out).length === 0) {
    const blocks = text.split(/IMAGE\s*\d+/i).slice(1);
    if (blocks.length === chunk.length) {
      chunk.forEach((t, i) => {
        const block = blocks[i] ?? "";
        const d = block.match(/DESCRIPTION:\s*([\s\S]*?)(?=VERDICT:|$)/i);
        const v = block.match(/VERDICT:\s*([^\n]*)/i);
        out[t.num] = {
          num: t.num,
          description: d ? d[1].trim() : "",
          verdict: v ? v[1].trim() : "",
        };
      });
    }
  }
  // fallback 2: model labelled sequentially Q1..QN (image order)
  if (Object.keys(out).length === 0) {
    const seq = text.split(/\n(?=Q\d+\b)/i).filter((b) => /^Q\d+\b/i.test(b.trim()));
    if (seq.length === chunk.length && !chunk.some((t) => new RegExp(`Q${t.num}\\b`, "i").test(text))) {
      chunk.forEach((t, i) => {
        const block = seq[i] ?? "";
        const d = block.match(/DESCRIPTION:\s*([\s\S]*?)(?=VERDICT:|$)/i);
        const v = block.match(/VERDICT:\s*([^\n]*)/i);
        out[t.num] = {
          num: t.num,
          description: d ? d[1].trim() : "",
          verdict: v ? v[1].trim() : "",
        };
      });
    }
  }
  return out;
}

async function callVision(zai, prompt, images, attempt = 0) {
  try {
    const res = await zai.chat.completions.createVision({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((p) => ({
              type: "image_url",
              image_url: { url: `data:image/png;base64,${readFileSync(p).toString("base64")}` },
            })),
          ],
        },
      ],
      thinking: { type: "disabled" },
    });
    return res.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    if (attempt < MAX_RETRY) {
      const wait = 12000 + attempt * 18000 + Math.random() * 5000;
      console.log(`  retry in ${Math.round(wait / 1000)}s (${e.message?.slice(0, 60)})`);
      await new Promise((r) => setTimeout(r, wait));
      return callVision(zai, prompt, images, attempt + 1);
    }
    throw e;
  }
}

async function main() {
  const zai = await ZAI.create();
  let ok = 0, partial = 0, failed = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const prompt = buildPrompt(chunk);
    try {
      const text = await callVision(zai, prompt, chunk.map((t) => t.image));
      const parsed = parseResponse(text, chunk);
      for (const t of chunk) {
        const r = parsed[t.num];
        if (r && (r.description || r.verdict)) {
          writeFileSync(`${OUT_DIR}/q${t.num}.json`, JSON.stringify(r, null, 1));
          ok++;
        }
      }
      const missing = chunk.filter((t) => !parsed[t.num] || (!parsed[t.num].description && !parsed[t.num].verdict));
      if (missing.length) {
        partial += missing.length;
        console.log(`chunk ${ci + 1}/${chunks.length}: ${missing.length} unparsed -> ${missing.map((m) => m.num).join(",")}`);
      } else {
        console.log(`chunk ${ci + 1}/${chunks.length}: all ${chunk.length} parsed`);
      }
    } catch (e) {
      failed += chunk.length;
      console.log(`chunk ${ci + 1}/${chunks.length} FAILED: ${e.message?.slice(0, 80)}`);
    }
    if (ci < chunks.length - 1) await new Promise((r) => setTimeout(r, PACE_MS));
  }
  console.log(`\nDone. ok=${ok} partial=${partial} failed=${failed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
