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
}


def norm(name: str) -> str:
    return name.replace("underscore", "_")


def collect_icon_names() -> set:
    names = set()
    pattern = re.compile(r"icon=\"([^\"]+)\"")
    for dirpath, _dirnames, filenames in os.walk(SRC_DIR):
        for fn in filenames:
            if not fn.endswith((".tsx", ".ts", ".jsx", ".js")):
                continue
            path = os.path.join(dirpath, fn)
            text = open(path, encoding="utf-8").read()
            for match in pattern.finditer(text):
                names.add(match.group(1))
    return names


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
    words = collect_icon_names()
    # Ignore names that are clearly dynamic (React expressions) — e.g. names
    # with ${ } or spaces. collect_icon_names() already only grabs quoted
    # literals, so nothing more to filter here.
    if not words:
        sys.exit("No icon names found under src/")

    with tempfile.TemporaryDirectory() as tmp:
        source = fetch_font(tmp)
        font = TTFont(source)
        gsub = font["GSUB"]
        records = collect_ligature_map(font)
        glyphs = set(font.getGlyphOrder())
        cmap = font.getBestCmap()
        gname2cp = {g: cp for cp, g in cmap.items()}

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
        opts.layout_features = ["rlig"]
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


if __name__ == "__main__":
    main()