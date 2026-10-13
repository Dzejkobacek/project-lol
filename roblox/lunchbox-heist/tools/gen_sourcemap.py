#!/usr/bin/env python3
"""Minimal Rojo-compatible sourcemap generator (no Rojo binary needed).
Reads default.project.json and writes sourcemap.json for luau-lsp analysis."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = (".luau", ".lua")
CLASS_BY_SUFFIX = {"": "ModuleScript", ".server": "Script", ".client": "LocalScript"}


def split_script(filename):
    """'Foo.server.luau' -> ('Foo', 'Script'); returns None for non-Luau files."""
    for ext in EXTS:
        if filename.endswith(ext):
            base = filename[: -len(ext)]
            for suffix in (".server", ".client"):
                if base.endswith(suffix):
                    return base[: -len(suffix)], CLASS_BY_SUFFIX[suffix]
            return base, CLASS_BY_SUFFIX[""]
    return None


def from_dir(path, name, class_name="Folder"):
    rel = os.path.relpath(path, ROOT)
    node = {"name": name, "className": class_name, "filePaths": [], "children": []}
    for entry in sorted(os.listdir(path)):
        full = os.path.join(path, entry)
        if os.path.isdir(full):
            node["children"].append(from_dir(full, entry))
            continue
        parsed = split_script(entry)
        if parsed is None:
            continue
        base, cls = parsed
        if base == "init":
            node["className"] = cls
            node["filePaths"] = [os.path.join(rel, entry)]
        else:
            node["children"].append(
                {"name": base, "className": cls, "filePaths": [os.path.join(rel, entry)], "children": []}
            )
    return node


def from_tree(name, spec):
    if "$path" in spec:
        node = from_dir(os.path.join(ROOT, spec["$path"]), name, spec.get("$className", "Folder"))
    else:
        node = {"name": name, "className": spec.get("$className", "Folder"), "filePaths": [], "children": []}
    for key, value in spec.items():
        if not key.startswith("$"):
            node["children"].append(from_tree(key, value))
    return node


def main():
    with open(os.path.join(ROOT, "default.project.json")) as f:
        proj = json.load(f)
    sm = from_tree(proj["name"], proj["tree"])
    out = os.path.join(ROOT, "sourcemap.json")
    with open(out, "w") as f:
        json.dump(sm, f, indent=1)
    print("wrote", out)


if __name__ == "__main__":
    sys.exit(main())
