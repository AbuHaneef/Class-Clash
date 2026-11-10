#!/usr/bin/env python3
"""Build the Primary Mathematics question bank from the parsed docx flow.

Reads /tmp/docx-extract/flow.json (from parse-primary-docx.py).
Extracts 1000 questions (P1-P6) with:
  - level, topic, doc number, stem, image media, options A-D, answer key letter
Writes /tmp/docx-extract/questions.json
Prints structure stats + anomalies.
"""
import json
import re

FLOW = "/tmp/docx-extract/flow.json"
OUT = "/tmp/docx-extract/questions.json"

flow = json.load(open(FLOW, encoding="utf-8"))

LEVEL_HDR = re.compile(r"^Primary ([1-6])$")
KEY_HDR = re.compile(r"^Primary ([1-6]) — Answer Key$")
Q_HDR = re.compile(r"^(\d+)\.\s+(.*)$")
KEY_PAIR = re.compile(r"(\d+)-([A-D])")

questions = []  # dicts
answer_keys = {}  # level -> {num: letter}
current_level = None
current_topic = None
in_key = False
pending_q = None  # question awaiting its options
opt_buffer = []

def flush_options():
    """Try to parse A)/B)/C)/D) out of opt_buffer; return list or None."""
    joined = " ".join(opt_buffer).strip()
    m = re.match(r"^A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*$", joined)
    if m:
        return [m.group(i).strip() for i in range(1, 5)]
    return None

def close_question():
    global pending_q, opt_buffer
    if pending_q is not None:
        opts = flush_options()
        if opts:
            pending_q["options"] = opts
            questions.append(pending_q)
        else:
            print(f"!! UNPARSEABLE OPTIONS: Q{pending_q['num']} buffer={opt_buffer!r}")
        pending_q = None
    opt_buffer = []

skipped_para_count = 0
for item in flow:
    if item["type"] == "image":
        if pending_q is not None and not pending_q.get("image"):
            pending_q["image"] = item["media"]
        else:
            print(f"!! ORPHAN IMAGE: {item['media']} (pending={pending_q and pending_q.get('num')})")
        continue

    text = item["text"]

    # answer key section?
    km = KEY_HDR.match(text)
    if km:
        close_question()
        in_key = True
        current_level = int(km.group(1))
        continue
    if in_key:
        pairs = KEY_PAIR.findall(text)
        if pairs:
            for num, letter in pairs:
                answer_keys.setdefault(current_level, {})[int(num)] = letter
            continue
        # a non-key paragraph ends the key section
        in_key = False

    # level header?
    lm = LEVEL_HDR.match(text)
    if lm:
        close_question()
        current_level = int(lm.group(1))
        current_topic = None
        continue

    # question stem?
    qm = Q_HDR.match(text)
    if qm and current_level and not in_key:
        num, stem = int(qm.group(1)), qm.group(2).strip()
        if pending_q is None:
            pending_q = {"num": num, "level": current_level, "topic": current_topic,
                         "stem": stem, "image": None}
        else:
            if not opt_buffer and re.match(r"^A\)", text) is None:
                pending_q["stem"] += " " + text
            else:
                close_question()
                pending_q = {"num": num, "level": current_level, "topic": current_topic,
                             "stem": stem, "image": None}
        continue

    # between questions (no pending stem): topic headers & meta lines
    if pending_q is None:
        if re.match(r"^\d+ questions across", text):
            continue
        if len(text) < 60 and not text.endswith("?") and not re.match(r"^(Primary|Contents|Each question)", text):
            current_topic = text
            continue
        skipped_para_count += 1
        continue

    # options or stem continuation (pending_q is not None)
    if re.match(r"^[abcd]\)", text, re.I) or re.search(r"\bB\)", text):
        opt_buffer.append(text)
        opts = flush_options()
        if opts:
            pending_q["options"] = opts
            questions.append(pending_q)
            pending_q = None
            opt_buffer = []
        continue
    # otherwise: stem continuation
    pending_q["stem"] += " " + text

close_question()

# ── attach answer keys ──
missing_key = []
for q in questions:
    letter = answer_keys.get(q["level"], {}).get(q["num"])
    if letter:
        q["answerLetter"] = letter
    else:
        missing_key.append((q["level"], q["num"]))
        q["answerLetter"] = None

# ── stats ──
print(f"Total questions parsed: {len(questions)}")
print(f"Missing answer keys: {len(missing_key)} {missing_key[:20]}")
by_level = {}
for q in questions:
    by_level.setdefault(q["level"], {"count": 0, "topics": {}, "images": 0})
    by_level[q["level"]]["count"] += 1
    by_level[q["level"]]["topics"][q["topic"]] = by_level[q["level"]]["topics"].get(q["topic"], 0) + 1
    if q["image"]:
        by_level[q["level"]]["images"] += 1
for lvl in sorted(by_level):
    d = by_level[lvl]
    print(f"\nPrimary {lvl}: {d['count']} questions, {d['images']} with images")
    for t, c in d["topics"].items():
        print(f"   {t}: {c}")

# duplicates check (same stem within same level+topic is fine, but flag exact stem dupes)
from collections import Counter
stem_counts = Counter(q["stem"] for q in questions)
dups = {s: c for s, c in stem_counts.items() if c > 1}
print(f"\nDuplicate stems: {len(dups)} distinct")
for s, c in sorted(dups.items(), key=lambda kv: -kv[1])[:25]:
    print(f"  {c}x  {s[:80]}")

# option sanity
bad_opts = [q["num"] for q in questions if len(q.get("options", [])) != 4]
print(f"\nQuestions without exactly 4 options: {len(bad_opts)} {bad_opts[:20]}")
no_topic = [q["num"] for q in questions if not q["topic"]]
print(f"Questions without topic: {len(no_topic)} {no_topic[:20]}")

json.dump(questions, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nWrote {OUT}")
