#!/usr/bin/env python3
"""Inspect parsed questions: stem integrity + samples per topic."""
import json

qs = json.load(open("/tmp/docx-extract/questions.json"))

print("Q45 (Number Bonds check):", [q["stem"] for q in qs if q["num"] == 45])

longest = sorted(qs, key=lambda q: -len(q["stem"]))[:6]
print("\n--- longest stems ---")
for q in longest:
    print(f"#{q['num']} [{q['topic']}] {q['stem'][:200]}")

print("\n--- topic samples ---")
for topic in sorted(set(q["topic"] for q in qs)):
    tqs = [q for q in qs if q["topic"] == topic]
    q = tqs[0]
    print(f"\n{topic} (n={len(tqs)}) e.g. #{q['num']}")
    print(f"  stem: {q['stem'][:150]}")
    print(f"  opts: {q['options']}  key: {q['answerLetter']}")
