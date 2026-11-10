#!/usr/bin/env python3
"""Parse Master_Competition_Questions.docx -> questions JSON with bold-detected answers."""
import json, os, re, sys
import docx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, "upload", "Master_Competition_Questions.docx")
OUT = os.path.join(ROOT, "scripts", "parsed-questions.json")

d = docx.Document(DOC)
paras = []
for p in d.paragraphs:
    text = p.text.strip()
    if not text:
        continue
    # a run is "significant" if it has real text; bold if run.bold is True (or style implies)
    bold_runs = []
    for r in p.runs:
        t = r.text.strip()
        if not t:
            continue
        is_bold = bool(r.bold) or (r.style is not None and getattr(r.style, "bold", False))
        bold_runs.append((t, is_bold))
    paras.append({"text": text, "runs": bold_runs})

# classify section headers like "70 Standard Chemistry Competition Questions"
section_re = re.compile(r"^\d+\s+Standard\s+(.+?)\s+Competition\s+Questions", re.I)
qstart_re = re.compile(r"^Q(\d+)\.\s*(.*)$")
opt_re = re.compile(r"^([A-D])[.\)]\s*(.*)$")

questions = []
section = None
cur = None

def flush():
    global cur
    if cur and cur.get("stem") and len(cur.get("options", [])) >= 2:
        questions.append(cur)
    cur = None

for p in paras:
    text = p["text"]
    m = section_re.match(text)
    if m and "Topics covered" not in text:
        flush()
        section = m.group(1).strip()
        continue
    if text.startswith("Topics covered") or text.startswith("The correct option"):
        continue
    mq = qstart_re.match(text)
    if mq:
        flush()
        cur = {"section": section, "num": int(mq.group(1)), "stem": mq.group(2).strip(), "options": [], "bold": []}
        # bold info for stem part (rarely matters)
        continue
    mo = opt_re.match(text)
    if mo and cur is not None:
        letter, body = mo.group(1), mo.group(2).strip()
        # is any significant run in this paragraph bold? (exclude the letter itself if separate)
        any_bold = any(is_bold for (t, is_bold) in p["runs"] if len(t) > 0 and t != letter and not re.fullmatch(r"[A-D][.\)]", t))
        # also treat: whole paragraph bold including letter
        if not any_bold:
            any_bold = all(is_bold for (t, is_bold) in p["runs"]) and len(p["runs"]) > 0
        cur["options"].append({"letter": letter, "text": body})
        if any_bold:
            cur["bold"].append(letter)
        continue
    # continuation text for stem or last option
    if cur is not None:
        if cur["options"]:
            cur["options"][-1]["text"] += " " + text
        else:
            cur["stem"] += " " + text
flush()

# stats
by_sec = {}
problems = []
for q in questions:
    by_sec.setdefault(q["section"], []).append(q)
    if len(q["options"]) != 4:
        problems.append(f"Q{q['num']} [{q['section']}]: {len(q['options'])} options")
    if len(q["bold"]) != 1:
        problems.append(f"Q{q['num']} [{q['section']}]: bold={q['bold']}")

print("Sections:")
for s, qs in by_sec.items():
    print(f"  {s}: {len(qs)} questions")
print(f"TOTAL: {len(questions)}")
print("\nPROBLEMS:" if problems else "\nNo structural problems.")
for pr in problems:
    print("  " + pr)

with open(OUT, "w") as f:
    json.dump(questions, f, indent=1, ensure_ascii=False)
print(f"\nSaved -> {OUT}")
