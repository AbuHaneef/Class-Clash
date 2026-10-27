#!/usr/bin/env python3
"""Process VLM verification results for the 120 image questions:
- parse both output formats (v1 'content', v2 'description'/'verdict')
- cross-check verdicts against answer keys (flag DISAGREES/UNSURE)
- soft check: key term should appear in the VLM text for classification topics
- generate explanations (key-derived templates, VLM-extracted numbers where possible)
Writes /tmp/docx-extract/vlm-processed.json  {num: {description, verdict, agrees, explanation, flags[]}}
"""
import json
import os
import re

OUT_DIR = "/tmp/docx-extract/vlm-out"
verified = json.load(open("/tmp/docx-extract/verified.json", encoding="utf-8"))
img_qs = [q for q in verified if q.get("image")]

def load_vlm(num):
    p = f"{OUT_DIR}/q{num}.json"
    if not os.path.exists(p):
        return None
    d = json.load(open(p, encoding="utf-8"))
    if "content" in d:  # v1 format
        text = d["content"]
        dm = re.search(r"DESCRIPTION:\s*([\s\S]*?)(?=VERDICT:|$)", text, re.I)
        vm = re.search(r"VERDICT:\s*([^\n]*)", text, re.I)
        return {"description": dm.group(1).strip() if dm else "", "verdict": vm.group(1).strip() if vm else ""}
    return {"description": d.get("description", ""), "verdict": d.get("verdict", "")}

# ── property blurbs for classification topics ──
SHAPE2D = {
    "Triangle": "a triangle — 3 straight sides",
    "Rectangle": "a rectangle — 4 sides with 4 right angles, opposite sides equal",
    "Square": "a square — 4 equal sides and 4 right angles",
    "Circle": "a circle — one curved edge, no straight sides",
}
SHAPE3D = {
    "Cube": "a cube — 6 flat square faces",
    "Cuboid": "a cuboid — 6 flat rectangular faces",
    "Cylinder": "a cylinder — 2 flat circular faces and 1 curved surface",
    "Cone": "a cone — 1 flat circular face and a curved surface that narrows to a point",
    "Sphere": "a sphere — a perfectly round ball with only a curved surface",
    "Pyramid": "a pyramid — a flat base with triangular faces meeting at a point",
}
QUAD = {
    "Rectangle": "a rectangle — 4 right angles, opposite sides equal and parallel",
    "Square": "a square — 4 equal sides and 4 right angles",
    "Rhombus": "a rhombus — all 4 sides equal in length",
    "Parallelogram": "a parallelogram — opposite sides parallel and equal in length",
    "Trapezium": "a trapezium — exactly one pair of parallel sides",
}
TRI = {
    "Equilateral triangle": "an equilateral triangle — all 3 sides equal (3 tick marks)",
    "Isosceles triangle": "an isosceles triangle — 2 sides equal (matching tick marks)",
    "Scalene triangle": "a scalene triangle — no equal sides (all tick marks different)",
    "Right-angled triangle": "a right-angled triangle — a square corner marks the 90° angle",
}
ANGLE = {
    "Acute angle": "an acute angle — it opens less than a right angle (less than 90°)",
    "Right angle": "a right angle — it opens exactly a quarter turn (90°)",
    "Obtuse angle": "an obtuse angle — it opens more than a right angle but less than a straight line (between 90° and 180°)",
    "Straight angle": "a straight angle — it opens exactly half a turn (180°)",
}
LINES = {
    "Parallel lines": "parallel lines — they never meet and stay the same distance apart",
    "Perpendicular lines": "perpendicular lines — they meet at a right angle (90°)",
    "Intersecting lines": "intersecting lines — they cross each other at a point",
    "Curved lines": "curved lines — they bend instead of going straight",
}

def key_main_term(key):
    """Main noun/term of the key for the soft presence check."""
    for term in (list(SHAPE3D) + list(QUAD) + list(TRI) + list(ANGLE) + list(LINES) + list(SHAPE2D)):
        if key.lower().startswith(term.lower()):
            return term
    return None

def nums_from(text):
    return [int(x) for x in re.findall(r"\d+(?:\.\d+)?", text)]

def explanation_for(q, vlm):
    stem, key, topic = q["stem"], q["options"]["ABCD".index(q["answerLetter"])], q["topic"]
    desc = (vlm.get("description", "") + " " + vlm.get("verdict", "")).lower() if vlm else ""
    s = stem.lower()
    if "how many sides" in s:
        return f"Counting the straight sides of the shape in the picture gives {key}."
    if "name of this 3d shape" in s:
        blurb = SHAPE3D.get(key, key)
        return f"The picture shows {blurb}."
    if "name of this quadrilateral" in s:
        blurb = QUAD.get(key, key)
        return f"The picture shows {blurb}."
    if "type of triangle" in s:
        blurb = TRI.get(key, key)
        return f"The marks in the picture show {blurb}."
    if "name of this shape" in s:
        blurb = SHAPE2D.get(key, key)
        return f"The picture shows {blurb}."
    if "type of angle" in s:
        blurb = ANGLE.get(key, key)
        return f"The angle in the picture is {blurb}."
    if "relationship between these two lines" in s:
        blurb = LINES.get(key, key)
        return f"The picture shows {blurb}."
    if "clock" in s:
        m = re.match(r"^(\d{1,2}):(\d{2})$", key)
        if m:
            h, mm = int(m.group(1)), int(m.group(2))
            if mm == 0:
                return f"The minute hand points to 12 and the hour hand is exactly on {h}, so the time is {h}:00."
            if mm == 15:
                return f"The minute hand points to 3 (15 minutes) and the hour hand is just past {h}, so the time is {h}:15 — quarter past {h}."
            if mm == 30:
                return f"The minute hand points to 6 (30 minutes) and the hour hand is halfway between {h} and {h + 1}, so the time is {h}:30 — half past {h}."
            if mm == 45:
                return f"The minute hand points to 9 (45 minutes) and the hour hand is nearly at {h + 1}, so the time is {h}:45 — quarter to {h + 1}."
            return f"The minute hand points to {mm // 5} ({mm} minutes) and the hour hand is just past {h}, so the time is {h}:{mm:02d}."
        return f"Reading the hour and minute hands gives {key}."
    if "coordinates of the marked point" in s:
        m = re.match(r"^\((-?\d+),\s*(-?\d+)\)$", key)
        if m:
            x, y = int(m.group(1)), int(m.group(2))
            return f"Counting from the origin: {x} step{'s' if abs(x) != 1 else ''} across (x) and {y} step{'s' if abs(y) != 1 else ''} vertically (y), so the point is ({x}, {y})."
        return f"Reading the grid gives the marked point {key}."
    if "angles are labelled" in s:
        # extract the two labelled angles from the VLM text
        angles = [a for a in nums_from(desc) if 0 < a < 180]
        if len(angles) >= 2 and (angles[0] + angles[1] + int(re.sub(r"\D", "", key) or 0) == 180
                                  if re.sub(r"\D", "", key) else False):
            a, b = angles[0], angles[1]
            return f"The three angles of a triangle add up to 180°: {a}° + {b}° = {a + b}°, and 180° - {a + b}° = {key}."
        try:
            third = int(re.sub(r"[^\d-]", "", key))
            return f"The three angles of a triangle add up to 180°. Subtracting the two labelled angles from 180° gives {third}°."
        except ValueError:
            return f"The angles in a triangle add up to 180°, so the third angle is {key}."
    if "rectangle" in s and "area" in s:
        lm = re.search(r"length\s*(?:is|of|=)?\s*(\d+)", desc)
        wm = re.search(r"width\s*(?:is|of|=)?\s*(\d+)", desc)
        if lm and wm:
            l, w = int(lm.group(1)), int(wm.group(1))
            return f"The rectangle in the picture is {l} by {w}, so its area is {l} x {w} = {key} square units."
        return f"Multiply the rectangle's labelled length by its width: the area is {key} square units."
    if "rectangle" in s and "perimeter" in s:
        lm = re.search(r"length\s*(?:is|of|=)?\s*(\d+)", desc)
        wm = re.search(r"width\s*(?:is|of|=)?\s*(\d+)", desc)
        if lm and wm:
            l, w = int(lm.group(1)), int(wm.group(1))
            return f"The rectangle in the picture is {l} by {w}, so its perimeter is 2 x ({l} + {w}) = {key}."
        return f"Add all four sides of the rectangle: the perimeter is {key}."
    if "triangle" in s and "area" in s:
        bm = re.search(r"base\s*(?:is|of|=)?\s*(\d+)", desc)
        hm = re.search(r"height\s*(?:is|of|=)?\s*(\d+)", desc)
        if bm and hm:
            b, h = int(bm.group(1)), int(hm.group(1))
            return f"The triangle has base {b} and height {h}, so its area is 1/2 x {b} x {h} = {key}."
        return f"Area of a triangle = 1/2 x base x height, which gives {key} for the triangle in the picture."
    return f"The picture shows the answer: {key}."

# ── main ──
# Adjudicated overrides after manual review of flags + focused re-checks:
# - 8 area/perimeter questions: VLM's own computation matched the key but it
#   mislabelled the verdict while second-guessing the format -> AGREE.
# - #583: "The lines intersect" (verb form) -> AGREE.
# - #260/#453/#471/#477/#510/#655/#656: focused single-image re-checks -> AGREE
#   (#260 additionally confirmed by deterministic convex-hull vertex counting = 6).
# - #96/#261/#266/#447: mechanical corner enumeration matched the keys -> AGREE.
ADJUDICATED_AGREE = {
    479, 520, 530, 610, 675, 681, 682, 684, 687, 583,
    260, 453, 471, 477, 510, 655, 656,
    96, 261, 266, 447,
}

processed = {}
problems = []
missing = []
for q in img_qs:
    vlm = load_vlm(q["num"])
    if vlm is None:
        missing.append(q["num"])
        continue
    verdict = vlm.get("verdict", "")
    v = verdict.upper()
    if q["num"] in ADJUDICATED_AGREE:
        agrees = True
        flags = ["ADJUDICATED-AGREE"]
    elif "DISAGREES" in v:
        agrees = False
        flags = ["DISAGREES"]
    elif "UNSURE" in v or not verdict:
        agrees = None
        flags = ["UNSURE"]
    else:
        agrees = True
        flags = []
    # soft check for classification keys (only for directly-agreed ones)
    key = q["options"]["ABCD".index(q["answerLetter"])]
    term = key_main_term(key)
    if agrees and term and not flags:
        text = (vlm.get("description", "") + " " + verdict).lower()
        if term.lower().split()[0] not in text:
            flags.append("KEY-TERM-MISSING")
    processed[q["num"]] = {
        "description": vlm.get("description", ""),
        "verdict": verdict,
        "agrees": agrees,
        "explanation": explanation_for(q, vlm),
        "flags": flags,
    }

json.dump(processed, open("/tmp/docx-extract/vlm-processed.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

n_ok = sum(1 for v in processed.values() if v["agrees"] is True)
n_dis = sum(1 for v in processed.values() if v["agrees"] is False)
n_unsure = sum(1 for v in processed.values() if v["agrees"] is None)
print(f"processed: {len(processed)}  agrees={n_ok}  disagrees={n_dis}  unsure={n_unsure}  missing={missing}")
print("\n-- DISAGREES / UNSURE / FLAGGED --")
for num, v in sorted(processed.items()):
    if v["agrees"] is not True or v["flags"]:
        q = next(x for x in img_qs if x["num"] == num)
        key = q["options"]["ABCD".index(q["answerLetter"])]
        print(f"#{num} [{q['topic']} P{q['level']}] key={key} flags={v['flags']}")
        print(f"   verdict: {v['verdict'][:150]}")
        print(f"   desc: {v['description'][:150]}")
