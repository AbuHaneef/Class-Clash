#!/usr/bin/env python3
"""Deterministically count the corners of the polygon in q260.png (and q453.png as a control).
Method: threshold the coloured shape, extract the largest connected component,
trace its boundary, and count dominant direction changes (corners)."""
import numpy as np
from PIL import Image

def count_corners(path, name):
    im = np.array(Image.open(path).convert("RGB")).astype(int)
    h, w, _ = im.shape
    # non-white mask (the shape is light blue on white)
    mask = (im.sum(axis=2) < 720)  # not near-white
    # largest connected component via simple flood from any mask pixel
    from collections import deque
    seen = np.zeros_like(mask, dtype=bool)
    best = None
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not seen[y, x]:
                comp = np.zeros_like(mask)
                dq = deque([(y, x)])
                seen[y, x] = True
                comp[y, x] = True
                while dq:
                    cy, cx = dq.popleft()
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            comp[ny, nx] = True
                            dq.append((ny, nx))
                if best is None or comp.sum() > best.sum():
                    best = comp
    comp = best
    ys, xs = np.where(comp)
    print(f"{name}: component pixels={comp.sum()}, bbox x[{xs.min()},{xs.max()}] y[{ys.min()},{ys.max()}]")

    # trace boundary: for each row take min/max x inside comp (outline approximation)
    top = {}
    bottom = {}
    for y in range(ys.min(), ys.max() + 1):
        row = np.where(comp[y])[0]
        if len(row):
            top[y] = (row.min(), row.max())
    # walk the boundary clockwise starting from topmost row, leftmost pixel
    points = []
    # left side downward
    for y in sorted(top):
        points.append((top[y][0], y))
    # right side upward
    for y in sorted(top, reverse=True):
        points.append((top[y][1], y))

    # compute heading changes
    corners = 0
    segs = []
    for i in range(1, len(points)):
        dx = points[i][0] - points[i-1][0]
        dy = points[i][1] - points[i-1][1]
        if (dx, dy) == (0, 0):
            continue
        segs.append((np.sign(dx), np.sign(dy)))
    # count direction changes with run-length filtering (ignore tiny jaggies < 4 steps)
    runs = []
    cur, n = None, 0
    for s in segs:
        if s == cur:
            n += 1
        else:
            if cur is not None and n >= 4:
                runs.append((cur, n))
            cur, n = s, 1
    if cur is not None and n >= 4:
        runs.append((cur, n))
    # corners = direction changes between significant runs
    for i in range(1, len(runs)):
        if runs[i][0] != runs[i-1][0]:
            corners += 1
    if len(runs) >= 2 and runs[0][0] != runs[-1][0]:
        corners += 1
    print(f"{name}: significant runs={len(runs)} -> estimated corners={len(runs)}")
    print(f"{name}: runs={runs}")
    return len(runs)

count_corners("/tmp/docx-extract/imgs/q260.png", "q260 (key=6)")
print()
count_corners("/tmp/docx-extract/imgs/q453.png", "q453 (key=8, VLM confirmed 8)")
