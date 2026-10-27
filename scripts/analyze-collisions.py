#!/usr/bin/env python3
"""Detect ALL normalized collisions under (a) the aggressive operator-stripping
convention and (b) a conservative lowercase+collapse convention, using the
verified question set. Classify each collision as TRUE duplicate (same answer)
or FALSE collision (distinct questions that must both be imported)."""
import json
import re
from collections import defaultdict

verified = json.load(open("/tmp/docx-extract/verified.json", encoding="utf-8"))

def norm_aggressive(text):
    t = re.sub(r"\s+", " ", text.lower()).strip()
    return "".join(c for c in t if c.isalnum() or c in " ?")

def norm_conservative(text):
    return re.sub(r"\s+", " ", text.lower()).strip()

def answer_of(q):
    return q["options"]["ABCD".index(q["answerLetter"])]

for name, fn in [("AGGRESSIVE (operators stripped)", norm_aggressive), ("CONSERVATIVE (operators kept)", norm_conservative)]:
    groups = defaultdict(list)
    for q in verified:
        if q["status"] == "skip_flawed":
            continue
        n = fn(q["stem"]) + (f" [q{q['num']}]" if q.get("image") else "")
        groups[n].append(q)
    dups = {k: v for k, v in groups.items() if len(v) > 1}
    print(f"\n=== {name}: {len(dups)} collision groups ===")
    false_count = 0
    for k, qs in sorted(dups.items()):
        answers = [answer_of(q) for q in qs]
        same = len(set(answers)) == 1
        tag = "TRUE-DUP (same answer)" if same else "FALSE-COLLISION (different answers!)"
        if not same:
            false_count += 1
        print(f"  {tag}: {[f'#{q[chr(34)+chr(34) if False else "num"]} P{q["level"]} ans={answer_of(q)}' for q in qs]}  '{qs[0]['stem'][:60]}'")
    print(f"  -> false collisions: {false_count}")
