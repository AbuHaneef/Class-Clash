#!/usr/bin/env python3
"""Hull-vertex counter applied to every 'How many sides' question; compare with keys."""
import json
import numpy as np
from PIL import Image
from scipy.spatial import ConvexHull

verified = json.load(open("/tmp/docx-extract/verified.json", encoding="utf-8"))

def count_vertices(path):
    im = np.array(Image.open(path).convert("RGB")).astype(int)
    mask = im.sum(axis=2) < 700
    ys, xs = np.where(mask)
    if len(xs) < 100:
        return None
    pts = np.column_stack([xs, ys]).astype(float)
    hull = ConvexHull(pts)
    verts = pts[hull.vertices].tolist()
    changed = True
    while changed and len(verts) > 3:
        changed = False
        out = []
        n = len(verts)
        for i in range(n):
            a, b, c = verts[(i - 1) % n], verts[i], verts[(i + 1) % n]
            u = [b[0] - a[0], b[1] - a[1]]
            v = [c[0] - b[0], c[1] - b[1]]
            cross = u[0] * v[1] - u[1] * v[0]
            dot = u[0] * v[0] + u[1] * v[1]
            turn = abs(np.degrees(np.arctan2(cross, dot)))
            if turn >= 25:
                out.append(b)
            else:
                changed = True
        verts = out
    return len(verts)

for q in verified:
    if q.get("image") and "How many sides" in q["stem"]:
        key = q["options"]["ABCD".index(q["answerLetter"])]
        counted = count_vertices(f"/tmp/docx-extract/imgs/q{q['num']}.png")
        match = "OK" if str(counted) == key else "** MISMATCH **"
        print(f"#{q['num']} P{q['level']} key={key} hull-count={counted} {match}")
