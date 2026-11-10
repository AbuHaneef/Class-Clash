#!/usr/bin/env python3
"""Parse PRIMARY SCHOOL MATHEMATICS.docx:
- full ordered text (paragraphs, incl. answer-key runs)
- embedded image references resolved to media files, in document order
Outputs a JSON stream: /tmp/docx-extract/flow.json
Each item: {"type": "text", "text": ...} or {"type": "image", "media": "image12.png"}
"""
import json
import os
import re
import zipfile
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCX = os.path.join(ROOT, "upload", "PRIMARY SCHOOL MATHEMATICS.docx")
OUT = "/tmp/docx-extract/flow.json"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

with zipfile.ZipFile(DOCX) as z:
    doc = z.read("word/document.xml")
    rels_xml = z.read("word/_rels/document.xml.rels")

# rId -> media target
rels_root = ET.fromstring(rels_xml)
rid_map = {}
for rel in rels_root.findall("rel:Relationship", NS):
    if "image" in rel.get("Type", ""):
        rid_map[rel.get("Id")] = rel.get("Target").split("/")[-1]

root = ET.fromstring(doc)
body = root.find("w:body", NS)

flow = []

def para_text_and_images(p):
    """Extract text of paragraph plus any embedded image media names (in order)."""
    texts = []
    images = []
    # iterate in document order over runs
    for node in p.iter():
        tag = node.tag
        if tag == f"{{{NS['w']}}}t":
            texts.append(node.text or "")
        elif tag == f"{{{NS['a']}}}blip":
            rid = node.get(f"{{{NS['r']}}}embed")
            if rid and rid in rid_map:
                images.append(rid_map[rid])
    return "".join(texts), images

for child in body:
    tag = child.tag
    if tag == f"{{{NS['w']}}}p":
        text, images = para_text_and_images(child)
        for img in images:
            flow.append({"type": "image", "media": img})
        if text.strip():
            flow.append({"type": "text", "text": text.strip()})
    elif tag == f"{{{NS['w']}}}tbl":
        # tables (unlikely in this doc, but handle): flatten rows
        for p in child.iter(f"{{{NS['w']}}}p"):
            text, images = para_text_and_images(p)
            for img in images:
                flow.append({"type": "image", "media": img})
            if text.strip():
                flow.append({"type": "text", "text": text.strip()})

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(flow, f, ensure_ascii=False, indent=0)

# quick stats
n_text = sum(1 for i in flow if i["type"] == "text")
n_img = sum(1 for i in flow if i["type"] == "image")
print(f"text paragraphs: {n_text}, images: {n_img}")
print("--- first 12 items ---")
for i in flow[:12]:
    print(i)
print("--- items around an image (first image ctx) ---")
idx = next(i for i, x in enumerate(flow) if x["type"] == "image")
for i in flow[max(0, idx - 3): idx + 3]:
    print(i)
