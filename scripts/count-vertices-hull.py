#!/usr/bin/env python3
"""Deterministic corner count for convex polygons: boundary pixels -> convex hull
-> merge collinear hull points -> vertex count. Validates on q453 (VLM-confirmed 8)
and answers q260 (key 6)."""
import numpy as np
from PIL import Image
from scipy.spatial import ConvexHull

def count_vertices(path, name):
    im = np.array(Image.open(path).convert("RGB")).astype(int)
    # shape mask: non-white AND not the black border-only interior...
    # the shape is a filled light-blue polygon; mask = clearly non-white pixels
    mask = im.sum(axis=2) < 700
    ys, xs = np.where(mask)
    pts = np.column_stack([xs, ys]).astype(float)
    hull = ConvexHull(pts)
    hx = pts[hull.vertices]
    # merge nearly-collinear consecutive hull points
    def angle(u, v):
        c = np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9)
        return np.degrees(np.arccos(np.clip(c, -1, 1)))
    # iterate until stable: drop points where the turn is < 25 degrees
    changed = True
    verts = hx.tolist()
    while changed and len(verts) > 3:
        changed = False
        out = []
        n = len(verts)
        for i in range(n):
            a, b, c = verts[(i - 1) % n], verts[i], verts[(i + 1) % n]
            u = [b[0] - a[0], b[1] - a[1]]
            v = [c[0] - b[0], c[1] - b[1]]
            # signed turn angle
            cross = u[0] * v[1] - u[1] * v[0]
            dot = u[0] * v[0] + u[1] * v[1]
            turn = abs(np.degrees(np.arctan2(cross, dot)))
            if turn >= 25:
                out.append(b)
            else:
                changed = True
        verts = out
    print(f"{name}: hull points={len(hull.vertices)}, true vertices after collinear merge={len(verts)}")

for path, name in [
    ("/tmp/docx-extract/imgs/q453.png", "q453 (key=8, VLM carefully counted 8)"),
    ("/tmp/docx-extract/imgs/q260.png", "q260 (key=6, VLM conflicted 6 vs 7)"),
    ("/tmp/docx-extract/imgs/q266.png", "q266 (control, P2 'How many sides' key=?)"),
    ("/tmp/docx-extract/imgs/q261.png", "q261 (control, key=5)"),
]:
    count_vertices(path, name)
