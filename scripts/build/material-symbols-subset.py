#!/usr/bin/env python3
"""Subset the Material Symbols Outlined variable font to only the icon
ligatures used in the codebase.

Downloads the full font from Google Fonts, keeps only the glyphs + rlig
ligature records referenced by <MaterialIcon icon="..."> usages, and writes a
small self-hosted woff2 into public/fonts/. This removes the runtime
dependency on fonts.googleapis.com — critical for low-bandwidth and offline
use on cheap Android phones.

Usage:
    python3 scripts/build/material-symbols-subset.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(ROOT, "..", "..", "src")
OUT = os.path.join(ROOT, "..", "..", "public", "fonts", "material-symbols-outlined.woff2")
MANIFEST = os.path.join(
    ROOT, "..", "..", "public", "fonts", "material-symbols-subset.json"
)

MATERIAL_CSS_URL = (
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght@20..48,300..700&display=swap"
)
UPLOAD_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
)

# Icons whose ligature name changed in the variable font build map to a
# visually equivalent glyph still present in the font.
SYNONYMS = {
    "help_outline": "help",
    "location_on": "location_searching",
    "file_download": "download",
    "error_outline": "error",
    "system_update": "system_update_alt",
    "report_problem": "error",
    "smart_toys": "smart_toy",
    "auto_fix_high": "auto_fix_normal",
    "delete_outline": "delete",
    "chat_bubble_outline": "chat_bubble",
    "install_mobile": "install_desktop",
    "emoji_events": "workspace_premium",
    "payroll": "payments",
    "elementary": "school",
}


def norm(name: str) -> str:
    return name.replace("underscore", "_")


WORD = r"[a-z0-9_]+"


def _quoted_words(text: str) -> set:
    return set(re.findall(r"""["']([a-z0-9_]+)["']""", text))


def collect_icon_names() -> tuple:
    names = set()
    # Names built at runtime and assigned to a local before being handed to
    # <MaterialIcon icon={...}/>, e.g.
    #     const trendIcon = cond ? "trending_up" : "trending_flat";
    # Kept separate and filtered against the real ligature map in main(),
    # because a ternary assignment also matches plenty of strings that are not
    # icons ("0", "100k", "airtel") and admitting those blind would turn the
    # build into warning spam.
    dynamic = set()
    # Icon ligatures are referenced across the codebase in several shapes:
    #   <MaterialIcon icon="name" />             -> icon="..."
    #   <MaterialIcon icon={cond ? "a" : "b"}/>  -> ternary prop
    #   <span className="material-symbols-outlined">name</span>
    #   { icon: "name" }  (nav/config objects)
    #   <MaterialIcon>name</MaterialIcon>        (children fallback)
    #   <MaterialIcon> name </MaterialIcon>      (whitespace-wrapped children)
    #   <MaterialIcon>{cond ? "a" : "b"}</...>   (ternary children)
    simple_prop = re.compile(r"""icon=["']([a-z0-9_]+)["']""")
    object_prop = re.compile(r"""icon:\s*["']([a-z0-9_]+)["']""")
    # icon={...} — grab every quoted literal inside the expression. Handles
    # ternaries, nested ternaries, and lookups. Each token is expanded
    # positionally via brace-balancing so multiple expressions per file are
    # all captured (a single greedy regex could not iterate past the first).
    expr_prop = re.compile(r"""icon=\{""", re.DOTALL)
    # <span className="...material-symbols-outlined...">word</span> and
    # <MaterialIcon>word</MaterialIcon>, tolerant of whitespace/newlines.
    class_child = re.compile(
        r"""material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</""",
        re.DOTALL,
    )
    icon_child = re.compile(
        r"""<MaterialIcon[^>]*>\s*([a-z0-9_]+)\s*</MaterialIcon>""",
        re.DOTALL,
    )
    # const <name> = <expr with a ternary>;  — the RHS is bounded so an
    # unterminated statement cannot swallow the rest of the file.
    ternary_assign = re.compile(r"""(?:const|let|var)\s+\w+\s*=\s*(.{0,400}?);""", re.DOTALL)
    # <MaterialIcon>{...ternary...</MaterialIcon> — capture quoted literals in
    # the expression body.
    expr_child = re.compile(
        r"""<MaterialIcon[^>]*>\{(.+?)</MaterialIcon>""", re.DOTALL
    )

    def _icon_exprs(text: str):
        """Yield the balanced JS expression following each `icon={` token."""
        for m in expr_prop.finditer(text):
            start = m.end()
            depth = 1
            i = start
            while i < len(text):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
            yield text[start:i]

    def scan(text: str):
        nonlocal names, dynamic
        for m in simple_prop.finditer(text):
            names.add(m.group(1))
        for m in object_prop.finditer(text):
            names.add(m.group(1))
        for branch in _icon_exprs(text):
            names |= _quoted_words(branch)
        for m in class_child.finditer(text):
            names.add(m.group(1))
        for m in icon_child.finditer(text):
            names.add(m.group(1))
        for m in expr_child.finditer(text):
            names |= _quoted_words(m.group(1))
        for m in ternary_assign.finditer(text):
            if "?" in m.group(1):
                dynamic |= _quoted_words(m.group(1))

    for dirpath, dirnames, filenames in os.walk(SRC_DIR):
        # Tests name icons as subjects under test rather than as icons the UI
        # renders. Scanning them pulls unused names into the shipped subset --
        # a test asserting a name is missing would add that very name to the
        # font. Skipped so the subset reflects only what is actually drawn.
        dirnames[:] = [d for d in dirnames if d != "__tests__"]
        for fn in filenames:
            if not fn.endswith((".tsx", ".ts", ".jsx", ".js")):
                continue
            if ".test." in fn or ".spec." in fn or fn.endswith((".test.tsx", ".spec.tsx")):
                continue
            path = os.path.join(dirpath, fn)
            with open(path, encoding="utf-8") as handle:
                scan(handle.read())
    return names, dynamic


def fetch_font(tmp: str) -> str:
    req = urllib.request.Request(MATERIAL_CSS_URL, headers={"User-Agent": UPLOAD_UA})
    css = urllib.request.urlopen(req, timeout=60).read().decode()
    url = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)", css)
    if not url:
        sys.exit("Could not find a woff2 URL in the Google Fonts CSS.")
    path = os.path.join(tmp, "source.woff2")
    req = urllib.request.Request(url.group(1), headers={"User-Agent": UPLOAD_UA})
    with urllib.request.urlopen(req, timeout=120) as resp:
        with open(path, "wb") as handle:
            handle.write(resp.read())
    return path


def collect_ligature_map(font: TTFont):
    """Map normalized icon name -> target glyph name for every rlig record."""
    records = {}
    for ftr in font["GSUB"].table.FeatureList.FeatureRecord:
        for idx in ftr.Feature.LookupListIndex:
            for st in font["GSUB"].table.LookupList.Lookup[idx].SubTable:
                inner = getattr(st, "ExtSubTable", st)
                if not hasattr(inner, "ligatures") or not inner.ligatures:
                    continue
                for first_gid, ligset in inner.ligatures.items():
                    for lig in ligset:
                        seq = norm(first_gid) + "".join(norm(c) for c in lig.Component)
                        records.setdefault(seq, lig.LigGlyph)
    return records


def prune_gsub(font: TTFont, needed: dict):
    kept = set(needed)
    for ftr in font["GSUB"].table.FeatureList.FeatureRecord:
        for idx in ftr.Feature.LookupListIndex:
            for st in font["GSUB"].table.LookupList.Lookup[idx].SubTable:
                inner = getattr(st, "ExtSubTable", st)
                if not hasattr(inner, "ligatures"):
                    continue
                pruned = {}
                for first_gid, ligset in inner.ligatures.items():
                    good = []
                    for lig in ligset:
                        word = norm(first_gid) + "".join(norm(c) for c in lig.Component)
                        if word in kept:
                            lig.LigGlyph = needed[word]
                            good.append(lig)
                    if good:
                        pruned[first_gid] = good
                inner.ligatures = pruned


def reindex_ligatures(font: TTFont):
    """Return (first-name -> word -> Ligature) map and a list of sub-tables."""
    return []
    # kept for clarity: unused today


def main():
    static_words, dynamic_words = collect_icon_names()
    if not static_words:
        sys.exit("No icon names found under src/")

    with tempfile.TemporaryDirectory() as tmp:
        source = fetch_font(tmp)
        font = TTFont(source)
        gsub = font["GSUB"]
        records = collect_ligature_map(font)
        glyphs = set(font.getGlyphOrder())
        cmap = font.getBestCmap()
        gname2cp = {g: cp for cp, g in cmap.items()}

        # A ternary assignment can hold any string, so admit only those that
        # actually resolve to a ligature in the source font. This is what keeps
        # a runtime-constructed icon (StatCard's trending_flat/trending_down)
        # from silently dropping out of the subset and rendering its own source
        # text in the UI.
        admitted = {w for w in dynamic_words if w in records or w in SYNONYMS.values()}
        words = static_words | admitted

        needed = {}
        for w in words:
            g = records.get(w) or (w if w in glyphs else None)
            if g is None:
                s = SYNONYMS.get(w, "")
                g = records.get(s) if s else None
            if g is None:
                g = SYNONYMS.get(w)
            if g is None:
                print(f"[warn] no glyph for icon '{w}' — skipping")
                continue
            needed[w] = g

        prune_gsub(font, needed)

        codepoints = set()
        for w, g in needed.items():
            cp = gname2cp.get(g)
            if cp is None:
                print(f"[warn] no cmap codepoint for icon '{w}' ('{g}')")
                continue
            codepoints.add(cp)

        opts = Options()
        opts.layout_features = ["liga", "rlig"]
        opts.name_IDs = ["*"]
        opts.name_legacy = True
        opts.notdef_glyph = True
        opts.notdef_outline = True
        ss = Subsetter(options=opts)
        ss.populate(unicodes=codepoints, text=" ".join(words))
        ss.subset(font)

        # Post-fix: re-inject rlig records the subsetter pruned because the
        # underscore glyph was absent from its glyph closure at prune time.
        records_after = set()
        sub_tables = []
        for ftr in font["GSUB"].table.FeatureList.FeatureRecord:
            for idx in ftr.Feature.LookupListIndex:
                for st in font["GSUB"].table.LookupList.Lookup[idx].SubTable:
                    inner = getattr(st, "ExtSubTable", st)
                    if hasattr(inner, "ligatures"):
                        sub_tables.append(inner)
                        for first_gid, ligset in inner.ligatures.items():
                            for lig in ligset:
                                records_after.add(
                                    norm(first_gid) + "".join(norm(c) for c in lig.Component)
                                )

        present_glyphs = set(font.getGlyphOrder())
        target = sub_tables[-1] if sub_tables else None
        if target is None:
            sys.exit("No ligature sub-tables survived subsetting; cannot post-fix GSUB.")

        added = 0
        for word, out in needed.items():
            if word in records_after:
                continue
            parts = [None if p == "" else p for p in word.split("_")]
            seq = word  # glyph sequence is the literal word chars
            first = seq[0]
            components = list(seq[1:])
            if first not in present_glyphs or any(c not in present_glyphs for c in components):
                print(f"[warn] cannot restore ligature for '{word}' — missing input glyphs")
                continue
            if out not in present_glyphs:
                print(f"[warn] cannot restore ligature for '{word}' — missing output glyph '{out}'")
                continue
            lig = otTables.Ligature()
            lig.Component = components
            lig.LigGlyph = out
            target.ligatures.setdefault(first, []).append(lig)
            added += 1

        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        font.save(OUT)
        font.close()

    # Verify
    check = TTFont(OUT)
    recs = set()
    for ftr in check["GSUB"].table.FeatureList.FeatureRecord:
        for idx in ftr.Feature.LookupListIndex:
            for st in check["GSUB"].table.LookupList.Lookup[idx].SubTable:
                inner = getattr(st, "ExtSubTable", st)
                if hasattr(inner, "ligatures") and inner.ligatures:
                    for first, ligset in inner.ligatures.items():
                        for lig in ligset:
                            recs.add(norm(first) + "".join(norm(c) for c in lig.Component))
    missing = sorted(w for w in words if w not in recs)
    print(f"icons: {len(words)} | records: {len(recs)} | restored: {added} | missing: {missing}")
    print(f"wrote {OUT} ({os.path.getsize(OUT):,} bytes)")

    # Record what actually made it into the font.
    #
    # A woff2 cannot be read from Node without a Brotli/font parser, so the
    # icons test cannot verify the binary directly. This manifest is the
    # contract: it lists the ligatures the saved font really contains, read
    # back out of it above, so the test catches an icon name that is not
    # covered instead of trusting the source list.
    with open(MANIFEST, "w", encoding="utf8") as fh:
        json.dump(
            {
                "font": os.path.basename(OUT),
                "ligatures": sorted(recs),
                "missing": missing,
                # What the scanner found in source. The icons test compares
                # this against "ligatures" so it uses the build's own
                # extraction rather than a looser regex that would flag every
                # object property in the codebase.
                "scanned": sorted(static_words | dynamic_words),
            },
            fh,
            indent=2,
            sort_keys=True,
        )
        fh.write("\n")
    print(f"wrote {MANIFEST} ({len(recs)} ligatures)")


if __name__ == "__main__":
    main()