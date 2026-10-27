// Focused re-verification of 7 ambiguous image questions with targeted prompts.
import ZAI from "z-ai-web-dev-sdk";
import { readFileSync, writeFileSync } from "fs";

const TASKS = JSON.parse(readFileSync("/tmp/docx-extract/vlm-tasks.json", "utf8"));

const FOCUS = {
  260: "Count the sides of this polygon VERY carefully, one by one, going around the outline. State each vertex count. A hexagon has 6 sides; a heptagon has 7. Is the total 6 or 7?",
  453: "Count the sides of this polygon VERY carefully, one by one, going around the outline. State the exact total number of sides (6, 7, 8 or 9?).",
  471: "This is an analog clock. The minute hand points exactly at 12. Which number is the hour hand closest to? Answer with the time in H:00 format.",
  477: "This is an analog clock. The minute hand points exactly at 12. Which number is the hour hand closest to? Answer with the time in H:00 format.",
  510: "Look at the angle marked in this image. Is its opening smaller than a quarter turn (acute/less than 90°), exactly a quarter turn (right/90°), or wider than a quarter turn but not a straight line (obtuse)? Answer with the type.",
  655: "Look at this triangle. Compare the LENGTHS of its three sides as drawn (they may just look different, with no tick marks). Are all three visibly different lengths (scalene), two the same (isosceles), or all the same (equilateral)? Also check for a square right-angle mark.",
  656: "Look at this triangle. Compare the LENGTHS of its three sides as drawn (they may just look different, with no tick marks). Are all three visibly different lengths (scalene), two the same (isosceles), or all the same (equilateral)? Also check for a square right-angle mark.",
};

const zai = await ZAI.create();
for (const num of Object.keys(FOCUS).map(Number)) {
  const t = TASKS.find((x) => x.num === num);
  const b64 = readFileSync(t.image).toString("base64");
  const opts = t.options.map((o, j) => `${"ABCD"[j]}) ${o}`).join("  ");
  const prompt = `Question: ${t.stem}\nOptions: ${opts}\nAnswer key: ${t.answerLetter}) ${t.options["ABCD".indexOf(t.answerLetter)]}\n\n${FOCUS[num]}\n\nAnswer format:\nFINDING: <your direct observation>\nVERDICT: <AGREES or DISAGREES with the answer key>`;
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
      console.log(`\n=== #${num} (key ${t.answerLetter}) ${t.options["ABCD".indexOf(t.answerLetter)]} ===`);
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
