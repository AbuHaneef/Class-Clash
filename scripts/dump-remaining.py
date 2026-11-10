#!/usr/bin/env python3
"""Dump all stems for topics whose patterns I haven't fully seen yet."""
import json

qs = json.load(open("/tmp/docx-extract/questions.json"))

TOPICS = [
    "Word Problems", "Fractions", "Decimals", "Percentages", "Volume",
    "Triangles", "Time", "Converting Units", "Ratio", "Algebra",
    "Negative Numbers", "Number Bases", "Order of Operations",
    "Multiplying Fractions", "Area", "Surface Area", "Coordinate Plane",
]
for topic in TOPICS:
    tqs = [q for q in qs if q["topic"] == topic]
    print(f"\n{'='*70}\n{topic} (n={len(tqs)})")
    for q in tqs:
        img = " [IMG]" if q["image"] else ""
        print(f"  #{q['num']} P{q['level']}{img} {q['stem']}")
        print(f"      {q['options']} key={q['answerLetter']}")
