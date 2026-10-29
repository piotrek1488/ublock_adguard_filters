#!/usr/bin/env python3
"""Combine several uBlock Origin filter lists into a single list.

Sources are listed in a manifest file (one per line). A source is either a
local path (relative to the current directory, so git submodule paths work)
or an https:// URL. `!#include` directives inside sources are expanded here,
because uBO cannot resolve them once the list is merged into one file.

The output is deterministic (no timestamps), so the CI job only commits when
the content really changes.

Usage:
    python3 scripts/build.py --sources sources.txt --header header.txt \
        --out dist/combined.txt
"""

import argparse
import os
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

TIMEOUT_S = 30
MAX_BYTES = 50 * 1024 * 1024
MAX_INCLUDE_DEPTH = 5
USER_AGENT = "ublock-lists-builder/1.0"

# Per-list metadata. Each source has its own, so they must not leak into
# the combined list (the header file provides the metadata instead).
META_PREFIXES = (
    "! title:",
    "! version:",
    "! expires:",
    "! homepage:",
    "! last modified:",
    "! checksum:",
    "! description:",
    "! licence:",
    "! license:",
    "! timeupdated:",
    "! redirect:",
    "! diff-path:",
    "! diff-name:",
)


class BuildError(Exception):
    pass


def is_url(ref: str) -> bool:
    return urllib.parse.urlparse(ref).scheme in ("http", "https")


def read_ref(ref: str) -> str:
    """Return the text of a local file or an https URL."""
    if is_url(ref):
        if not ref.startswith("https://"):
            raise BuildError(f"only https:// URLs are allowed: {ref}")
        req = urllib.request.Request(ref, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                data = resp.read(MAX_BYTES + 1)
        except Exception as exc:  # network errors must fail the build
            raise BuildError(f"cannot fetch {ref}: {exc}") from exc
        if len(data) > MAX_BYTES:
            raise BuildError(f"{ref} is larger than {MAX_BYTES} bytes")
        return data.decode("utf-8", errors="replace")

    path = Path(ref)
    if not path.is_file():
        raise BuildError(f"local source not found: {ref}")
    return path.read_text(encoding="utf-8", errors="replace")


def resolve_include(parent: str, name: str) -> str:
    """Resolve an !#include target the way uBO does: same directory or below."""
    if (
        not name
        or "://" in name
        or name.startswith("/")
        or ".." in Path(name).parts
    ):
        raise BuildError(
            f"unsupported !#include '{name}' in {parent} "
            "(only same directory or subdirectory is allowed)"
        )
    if is_url(parent):
        return urllib.parse.urljoin(parent, name)
    return str(Path(parent).parent / name)


def expand(ref: str, depth: int = 0, stack: tuple = ()) -> list:
    """Return the lines of `ref` with all !#include directives expanded."""
    if ref in stack:
        raise BuildError(f"circular !#include: {' -> '.join(stack + (ref,))}")
    if depth > MAX_INCLUDE_DEPTH:
        raise BuildError(f"!#include nested deeper than {MAX_INCLUDE_DEPTH}: {ref}")

    lines = []
    for raw in read_ref(ref).splitlines():
        line = raw.rstrip()
        if line.startswith("!#include "):
            target = resolve_include(ref, line[len("!#include "):].strip())
            lines.extend(expand(target, depth + 1, stack + (ref,)))
        else:
            lines.append(line)
    return lines


def read_manifest(path: Path) -> list:
    sources = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            sources.append(line)
    if not sources:
        raise BuildError(f"no sources listed in {path}")
    return sources


def combine(sources: list, header: str) -> tuple:
    out = [header.rstrip("\n")] if header.strip() else []
    seen = set()
    if_depth = 0  # filters inside !#if blocks are conditional: never dedupe them
    kept = dropped = 0

    for ref in sources:
        out.append(f"! ---- source: {ref} ----")
        for line in expand(ref):
            low = line.strip().lower()
            if not low:
                continue
            if low.startswith(META_PREFIXES) or (
                low.startswith("[") and low.endswith("]")
            ):
                continue
            if line.startswith("!#if"):
                if_depth += 1
            elif line.startswith("!#endif"):
                if_depth = max(0, if_depth - 1)

            is_comment = line.startswith("!")
            if not is_comment and if_depth == 0:
                if line in seen:
                    dropped += 1
                    continue
                seen.add(line)
            if not is_comment:
                kept += 1
            out.append(line)

    return "\n".join(out) + "\n", kept, dropped


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".build-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sources", default="sources.txt", type=Path)
    ap.add_argument("--header", default="header.txt", type=Path)
    ap.add_argument("--out", default="dist/combined.txt", type=Path)
    args = ap.parse_args()

    try:
        header = args.header.read_text(encoding="utf-8") if args.header.is_file() else ""
        text, kept, dropped = combine(read_manifest(args.sources), header)
    except BuildError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    # Written only after everything was fetched, so a failure never
    # overwrites the last good list with a partial one.
    write_atomic(args.out, text)
    print(
        f"wrote {args.out}: {kept} filters, {dropped} duplicates removed",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
