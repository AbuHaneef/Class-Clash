#!/usr/bin/env python3
"""Stage image questions for VLM verification: copy each docx image to
/tmp/docx-extract/imgs/q{num}.png and build vlm-tasks.json with per-topic prompts."""
import json
import os
import shutil

SRC_DIR = "/tmp/docx-extract/unzipped/word/media"
OUT_DIR = "/tmp/docx-extract/imgs"
os.makedirs(OUT_DIR, exist_ok=True)

results = json.load(open("/tmp/docx-extract/verified.json", encoding="utf-8"))
img_qs = [q for q in results if q.get("image")]
print(f"Image questions: {len(img_qs)}")

def prompt_for(q):
    stem = q["stem"]
    opts = " ".join(f"{LET}) {o}" for LET, o in zip("ABCD", q["options"]))
    key = q["answerLetter"]
    base = (
        f"This image belongs to a primary school mathematics multiple-choice question.\n"
        f"Question: {stem}\n"
        f"Options: {opts}\n"
        f"Answer key says: {key}) {q['options']['ABCD'.index(key)]}\n"
    )
    s = stem.lower()
    if "clock" in s:
        ask = ("Look at the analog clock in the image. Report: (1) which number the HOUR hand is closest to / just past, "
               "(2) which number the MINUTE hand points to, (3) the exact time shown as H:MM. "
               "Then say whether the answer key agrees with what the clock shows.")
    elif "how many sides" in s:
        ask = ("Look at the shape in the image. Report: (1) the exact number of sides you can count, (2) the shape's name. "
               "Then say whether that side count matches the answer key.")
    elif "type of angle" in s:
        ask = ("Look at the angle in the image (two rays from a common vertex). Report: (1) whether it opens less than, "
               "exactly at, or more than a quarter turn / right angle, (2) the angle type: acute, right, obtuse or straight. "
               "Then say whether the answer key agrees.")
    elif "relationship between these two lines" in s:
        ask = ("Look at the two lines in the image. Report: (1) do they cross, meet at a square corner, never meet, or curve? "
               "(2) the relationship name: intersecting, perpendicular, parallel or curved lines. "
               "Then say whether the answer key agrees.")
    elif "name of this quadrilateral" in s:
        ask = ("Look at the quadrilateral in the image. Report: (1) how many sides are equal, (2) whether it has right angles, "
               "(3) its name among: rectangle, square, rhombus, parallelogram, trapezium. "
               "Then say whether the answer key agrees.")
    elif "3d shape" in s:
        ask = ("Look at the 3D shape in the image. Report: (1) its faces/edges in brief, (2) its name among: cube, cuboid, "
               "cylinder, cone, sphere, pyramid. Then say whether the answer key agrees.")
    elif "name of this shape" in s:
        ask = ("Look at the 2D shape in the image. Report: (1) how many sides it has and whether they are equal, "
               "(2) its name among: triangle, rectangle, square, circle. Then say whether the answer key agrees.")
    elif "coordinates of the marked point" in s:
        ask = ("Look at the coordinate grid in the image. Report the (x, y) coordinates of the marked point by counting "
               "the grid lines from the origin (state the axes labels you see, e.g. x-axis and y-axis, including any negative numbers). "
               "Then say whether the answer key agrees.")
    elif "rectangle in the picture" in s and "area" in s:
        ask = ("Look at the rectangle in the image. Report the labelled length and width. Then compute length x width and say "
               "whether the answer key agrees.")
    elif "rectangle in the picture" in s and "perimeter" in s:
        ask = ("Look at the rectangle in the image. Report the labelled length and width. Then compute 2 x (length + width) "
               "and say whether the answer key agrees.")
    elif "triangle in the picture" in s and "area" in s:
        ask = ("Look at the triangle in the image. Report the labelled base and height (and any units). Then compute "
               "1/2 x base x height and say whether the answer key agrees.")
    elif "triangle" in s and "angles are labelled" in s:
        ask = ("Look at the triangle in the image. Report the two labelled angles in degrees. Then compute the third angle "
               "(angles in a triangle sum to 180) and say whether the answer key agrees.")
    elif "type of triangle" in s:
        ask = ("Look at the triangle in the image, including its tick marks (equal sides) and angle marks (e.g. square corner). "
               "Report: (1) which sides are marked equal, (2) whether a right angle is marked, (3) the triangle type among: "
               "equilateral, isosceles, scalene, right-angled. Then say whether the answer key agrees.")
    else:
        ask = "Describe exactly what the image shows and say whether the answer key agrees with it."
    return base + "\n" + ask + "\n\nAnswer in this exact format:\nDESCRIPTION: <one or two short sentences>\nVERDICT: <AGREES or DISAGREES or UNSURE> <one short reason>"

tasks = []
for q in img_qs:
    src = os.path.join(SRC_DIR, q["image"])
    dst = os.path.join(OUT_DIR, f"q{q['num']}.png")
    shutil.copyfile(src, dst)
    tasks.append({
        "num": q["num"],
        "topic": q["topic"],
        "level": q["level"],
        "stem": q["stem"],
        "options": q["options"],
        "answerLetter": q["answerLetter"],
        "image": dst,
        "prompt": prompt_for(q),
    })

json.dump(tasks, open("/tmp/docx-extract/vlm-tasks.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"Wrote {len(tasks)} tasks. Topics: ", end="")
from collections import Counter
print(dict(Counter(t['topic'] for t in tasks)))
