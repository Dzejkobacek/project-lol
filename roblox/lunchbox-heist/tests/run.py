#!/usr/bin/env python3
"""Runs the pure-Luau unit tests (Config/Economy/Util/Signal) with the plain `luau` CLI.
Roblox globals used by those modules are stubbed; Roblox `require(script.Parent.X)` is emulated."""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.environ.get("LUAU_TOOLS", "/root/.luau-tools")
SHARED = os.path.join(ROOT, "src", "shared")
MODULES = ["Signal", "Util", "Config", "Economy"]

PRELUDE = r"""
local function mkColor() return setmetatable({}, {__index = function() return 0 end}) end
Color3 = { fromRGB = function() return mkColor() end, new = function() return mkColor() end }
task = { spawn = function(f, ...) f(...) end, wait = function() end }
local loaded = {}
local scripts = {}
function require(m) return m end
"""


def build():
    out = [PRELUDE]
    for name in MODULES:
        with open(os.path.join(SHARED, name + ".luau")) as f:
            src = f.read().replace("--!strict", "")
        out.append(f"scripts.{name} = {{ Parent = scripts }}")
    for name in MODULES:
        with open(os.path.join(SHARED, name + ".luau")) as f:
            src = f.read().replace("--!strict", "")
        out.append(f"do local script = scripts.{name}\nloaded.{name} = (function()\n{src}\nend)()\nend")
        out.append(f"scripts.{name} = loaded.{name}")
    out.append("local Signal, Util, Config, Economy = loaded.Signal, loaded.Util, loaded.Config, loaded.Economy")
    with open(os.path.join(ROOT, "tests", "economy_test.luau")) as f:
        out.append(f.read())
    return "\n".join(out)


def main():
    with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False) as tmp:
        tmp.write(build())
        path = tmp.name
    try:
        r = subprocess.run([os.path.join(TOOLS, "luau"), path], capture_output=True, text=True)
        sys.stdout.write(r.stdout)
        sys.stderr.write(r.stderr)
        return r.returncode
    finally:
        os.unlink(path)


if __name__ == "__main__":
    sys.exit(main())
