// Debug: dump the raw VLM response for one failing chunk.
import ZAI from "z-ai-web-dev-sdk";
import { readFileSync } from "fs";

const TASKS = JSON.parse(readFileSync("/tmp/docx-extract/vlm-tasks.json", "utf8"));
const nums = [353, 442, 443, 444];
const chunk = TASKS.filter((t) => nums.includes(t.num));

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
    `Q<num>\nDESCRIPTION: <one short sentence describing exactly what the image shows>\n` +
    `VERDICT: <AGREES | DISAGREES | UNSURE> — <one short reason>\n\n` +
    "Judge only from what the image actually shows.\n\n" + parts.join("\n\n")
  );
}

const zai = await ZAI.create();
const res = await zai.chat.completions.createVision({
  messages: [{
    role: "user",
    content: [
      { type: "text", text: buildPrompt(chunk) },
      ...chunk.map((t) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(t.image).toString("base64")}` } })),
    ],
  }],
  thinking: { type: "disabled" },
});
console.log("=== RAW RESPONSE ===");
console.log(res.choices?.[0]?.message?.content);
