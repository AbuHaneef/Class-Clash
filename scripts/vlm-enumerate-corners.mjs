// Mechanical vertex enumeration for the remaining disputed side-count questions.
import ZAI from "z-ai-web-dev-sdk";
import { readFileSync, writeFileSync } from "fs";

const TASKS = JSON.parse(readFileSync("/tmp/docx-extract/vlm-tasks.json", "utf8"));
const NUMS = [96, 261, 266, 447];

const zai = await ZAI.create();
for (const num of NUMS) {
  const t = TASKS.find((x) => x.num === num);
  const b64 = readFileSync(t.image).toString("base64");
  const key = t.options["ABCD".indexOf(t.answerLetter)];
  const prompt =
    `This image shows ONE main polygon (there may be dots, small marks or labels near it — ignore those, count only the polygon's corners). ` +
    `Go around the polygon clockwise, starting from the top-most corner, and list EVERY corner one by one with a letter (A, B, C, ...) and a short position note (e.g. "A: top", "B: upper right"). ` +
    `Then state the final count. If the polygon is concave (has a dent), include the inward corner too. If it is a circle, say so.\n\n` +
    `Answer key claims: ${key} sides. Is the key right?\n\n` +
    `Format:\nCORNERS: A: <pos>, B: <pos>, ...\nCOUNT: <n>\nVERDICT: <AGREES or DISAGREES>`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await zai.chat.completions.createVision({
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        }],
        thinking: { type: "disabled" },
      });
      const content = res.choices?.[0]?.message?.content ?? "";
      console.log(`\n=== #${num} (key ${key}) ===`);
      console.log(content);
      writeFileSync(`/tmp/docx-extract/vlm-out/focus-q${num}.json`, JSON.stringify({ num, content }, null, 1));
      break;
    } catch (e) {
      console.log(`#${num} attempt ${attempt} failed: ${e.message?.slice(0, 60)}`);
      await new Promise((r) => setTimeout(r, 15000 + attempt * 20000));
    }
  }
  await new Promise((r) => setTimeout(r, 8000));
}
