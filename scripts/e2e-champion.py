#!/usr/bin/env python3
"""Champion match E2E: answer SS2 Physics questions correctly to win the crown."""
import subprocess, json, re, time

ANSWER_KEY = [
    ("si unit of force", "newton"),
    ("acceleration due to gravity", "9.8"),
    ("uniform velocity", "zero"),
    ("accelerates uniformly from rest to 20 m/s", "4 m/s"),
    ("work done (and energy) is measured", "joules"),
    ("ohm's law states", "IR"),
    ("power dissipated by a 10", "40 W"),
    ("energy a body has because of its motion", "kinetic"),
    ("shortest wavelength", "gamma"),
    ("lever, pulley", "simple machines"),
]

def snapshot_text():
    out = subprocess.run(
        ["agent-browser", "snapshot", "-i", "-c", "--json"],
        capture_output=True, text=True, timeout=30,
    ).stdout
    data = json.loads(out)
    return data.get("data", {}).get("snapshot", "")

def parse_elements(snap):
    elements = []
    for line in snap.splitlines():
        m = re.match(r'\s*-\s+(?:button|link|textbox|heading|radio|combobox)\s+"([^"]*)"(?:.*\[ref=(e\d+)\])?', line)
        if m:
            elements.append({"name": m.group(1), "ref": m.group(2)})
    return elements

def click(ref):
    subprocess.run(["agent-browser", "click", ref], capture_output=True, text=True, timeout=30)

def correct_answer_for(question_text):
    q = question_text.lower()
    for prefix, answer in ANSWER_KEY:
        if prefix in q:
            return answer
    return None

def play():
    for _ in range(12):
        snap = snapshot_text()
        if "Review & Learn" in snap or "NEW CHAMPION" in snap or "Match details" in snap:
            break
        elements = parse_elements(snap)
        # question heading
        question = next((e["name"] for e in elements if e.get("ref") and "Question" not in e["name"] and "?" in e["name"]), None)
        # find option buttons
        options = [e for e in elements if e.get("ref") and e["name"].startswith("Option ")]
        if not options:
            time.sleep(1.2)
            # maybe on results / duel detail already
            url = subprocess.run(["agent-browser", "get", "url"], capture_output=True, text=True).stdout
            if "/results/" in url or "/duel/" in url:
                break
            continue
        # get the actual question text from full snapshot (headings without ?)
        full = subprocess.run(["agent-browser", "snapshot", "-c"], capture_output=True, text=True, timeout=30).stdout
        qmatch = re.search(r'heading "([^"]+)"\[level=2', full.replace(' [level=2', '[level=2'))
        if not qmatch:
            qmatch = re.search(r'heading "([^"]{10,120}\?)"', full)
        qtext = qmatch.group(1) if qmatch else ""
        ans = correct_answer_for(qtext)
        target = None
        if ans:
            for o in options:
                if ans.lower() in o["name"].lower():
                    target = o["ref"]
                    break
        if target is None:
            target = options[0]["ref"]
        click(target)
        time.sleep(0.7)
        # competitive mode auto-advances; wait for next question
        time.sleep(0.8)
    url = subprocess.run(["agent-browser", "get", "url"], capture_output=True, text=True).stdout
    print(f"final url: {url.strip()}")

if __name__ == "__main__":
    play()
