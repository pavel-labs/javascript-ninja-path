#!/usr/bin/env python3
"""Extract study cards from the original HTML; the source file is not published."""

import base64
import html
import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOID = set("area base br col embed hr img input link meta param source track wbr".split())


class Element:
    def __init__(self, tag="", attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []

    def has(self, name):
        return name in self.attrs.get("class", "").split()

    def find(self, predicate):
        for child in self.children:
            if isinstance(child, Element):
                if predicate(child):
                    yield child
                yield from child.find(predicate)

    def text(self):
        return "".join(c.text() if isinstance(c, Element) else c for c in self.children)


class Document(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


SECTIONS = [
    ("react", "React", "React & mobile"),
    ("react-19", "React 19+", "React & mobile"),
    ("server-components-nextjs", "RSC & Next.js", "React & mobile"),
    ("react-native-core", "React Native Core", "React & mobile"),
    ("react-native-ui-performance", "RN UI & Performance", "React & mobile"),
    ("react-native-shipping", "RN Native & Shipping", "React & mobile"),
    ("javascript", "JavaScript Core", "Language & data"),
    ("async-web-apis", "Async & Web APIs", "Language & data"),
    ("typescript", "TypeScript", "Language & data"),
    ("state-management", "State Management", "Language & data"),
    ("architecture", "Architecture", "Engineering"),
    ("solid-oop", "SOLID & OOP", "Engineering"),
    ("design-systems", "Design Systems", "Engineering"),
    ("performance", "Performance", "Engineering"),
    ("css-responsive", "CSS & Responsive", "Engineering"),
    ("testing", "Testing", "Engineering"),
    ("browser-network-security", "Browser & Network", "The web platform"),
    ("owasp", "OWASP Security", "The web platform"),
    ("modern-css", "Modern CSS", "The web platform"),
    ("html", "HTML & HTML5", "The web platform"),
]


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def serialize(node):
    if isinstance(node, str):
        return html.escape(node, quote=False)
    if node.has("ql") or node.has("nq") or node.tag in {"script", "style"}:
        return ""
    attrs = []
    for key, value in node.attrs.items():
        if key in {"class", "id", "src", "alt", "colspan", "rowspan", "href", "title"}:
            attrs.append(f' {key}="{html.escape(value or "", quote=True)}"')
        elif key == "style" and node.tag == "i":
            # Preserve the colour keys that explain the architecture figure.
            if re.fullmatch(r"background\s*:\s*#[0-9a-fA-F]{3,8};?", value.strip()):
                attrs.append(f' style="{value}"')
    start = f"<{node.tag}{''.join(attrs)}>"
    if node.tag in VOID:
        return start
    return start + "".join(serialize(c) for c in node.children) + f"</{node.tag}>"


def extract(source):
    document = Document()
    document.feed(Path(source).read_text())
    sections = list(document.root.find(lambda n: n.has("section")))
    if len(sections) != len(SECTIONS):
        raise ValueError(f"Expected {len(SECTIONS)} sections, found {len(sections)}")
    result = []
    audit = Counter()
    ids = set()
    for section, (slug, short_title, group) in zip(sections, SECTIONS):
        title = next(section.find(lambda n: n.tag == "h2")).text().strip()
        topics = []
        for card in section.find(lambda n: n.has("qcard")):
            label = next(card.find(lambda n: n.has("ql")))
            heading = next(card.find(lambda n: n.tag in {"h4", "h3"}), None)
            topic_title = heading.text() if heading else re.sub(r"^.*?Q\s*[—–-]\s*", "", label.text())
            topic_id = card.attrs.get("id")
            if not topic_id or topic_id in ids:
                raise ValueError(f"Missing or repeated topic ID: {topic_id}")
            ids.add(topic_id)
            priority = next((p for p in ["key", "basic", "med", "hard", "scen"] if label.has(p)), "med")
            for image in card.find(lambda n: n.tag == "img"):
                src = image.attrs["src"]
                if src.startswith("data:image/png;base64,"):
                    filename = "react-native-architecture.png"
                    (ROOT / "assets" / filename).write_bytes(base64.b64decode(src.split(",", 1)[1]))
                    image.attrs["src"] = f"$ASSET/{filename}"
            body = "".join(serialize(c) for c in card.children if c is not heading).strip()
            audit["topics"] += 1
            audit["followups"] += len(list(card.find(lambda n: n.has("fu-item"))))
            audit["codeExamples"] += len(list(card.find(lambda n: n.tag == "pre")))
            topics.append({"id": topic_id, "title": normalize(topic_title), "priority": priority, "html": body})
        result.append({"slug": slug, "title": title, "shortTitle": short_title, "group": group, "topics": topics})
    return result, audit


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/import-html.py /path/to/source.html")
    sections, audit = extract(sys.argv[1])
    for section in sections:
        (ROOT / "content" / f'{section["slug"]}.json').write_text(json.dumps(section, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "content" / "catalog.json").write_text(json.dumps({
        "sections": [s["slug"] for s in sections],
        "source": "senior-frontend-interview-v9.html",
        "imported": dict(audit),
    }, indent=2) + "\n")
    print(json.dumps({"sections": len(sections), **audit}, indent=2))


if __name__ == "__main__":
    main()
