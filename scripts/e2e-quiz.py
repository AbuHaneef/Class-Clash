#!/usr/bin/env python3
"""ClassClash browser E2E: answer all quiz questions until results screen."""
import subprocess, json, sys, time

def snapshot_interactive():
    out = subprocess.run(
        ["agent-browser", "snapshot", "-i", "-c", "--json"],
        capture_output=True, text=True, timeout=30,
    ).stdout
    try:
        data = json.loads(out)
        snap = data.get("data", {}).get("snapshot", "")
        # snapshot is a yaml-ish text with lines like: - button "Name" [ref=e12]
        import re
        elements = []
        for line in snap.splitlines():
            m = re.match(r'\s*-\s+(?:button|link|textbox|heading|radio|checkbox|combobox)\s+"([^"]*)".*\[ref=(e\d+)\]', line)
            if m:
                elements.append({"name": m.group(1), "ref": m.group(2)})
        return elements
    except Exception:
        return []

def click(ref):
    subprocess.run(["agent-browser", "click", ref], capture_output=True, text=True, timeout=30)

def answer_all(max_questions=25):
    answered = 0
    for _ in range(max_questions):
        els = snapshot_interactive()
        opt = next((e["ref"] for e in els if "Option 1:" in e.get("name", "")), None)
        nxt = next(
            (e["ref"] for e in els if "Next Question" in e.get("name", "") or "See Results" in e.get("name", "")),
            None,
        )
        results = any("Review & Learn" in json.dumps(e) for e in els)
        if opt is None:
            # maybe we're on results already or loading
            if answered > 0 and opt is None and nxt is None:
                break
            time.sleep(1.2)
            continue
        click(opt)
        time.sleep(0.9)
        els = snapshot_interactive()
        nxt = next(
            (e["ref"] for e in els if "Next Question" in e.get("name", "") or "See Results" in e.get("name", "")),
            None,
        )
        if nxt:
            click(nxt)
            answered += 1
            time.sleep(1.0)
        else:
            answered += 1
            time.sleep(1.0)
        # check if finished (url change to results)
        url = subprocess.run(["agent-browser", "get", "url"], capture_output=True, text=True, timeout=15).stdout
        if "/results/" in url:
            break
    return answered

if __name__ == "__main__":
    n = answer_all()
    url = subprocess.run(["agent-browser", "get", "url"], capture_output=True, text=True, timeout=15).stdout
    print(f"answered={n} url={url.strip()}")
