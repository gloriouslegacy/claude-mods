#!/usr/bin/env bash
# check.sh — validate (and test) every plugin the marketplace lists, and check that each plugin's
# version in marketplace.json matches its own plugin.json. Used by CI, the release workflow and
# before tagging a release by hand.
#
#   bash scripts/check.sh            validate + test
#   bash scripts/check.sh --no-test  validate only (also: SKIP_PLUGIN_TESTS=true)
set -euo pipefail
cd "$(dirname "$0")/.."

run_tests=true
[ "${1:-}" = "--no-test" ] && run_tests=false
[ "${SKIP_PLUGIN_TESTS:-}" = "true" ] && run_tests=false

command -v claude >/dev/null || { echo "check: the claude CLI is not on PATH" >&2; exit 1; }
command -v node >/dev/null || { echo "check: node is not on PATH" >&2; exit 1; }
echo "check: $(claude --version)"

failed=()

# Intended copies across plugins must stay in step (line endings ignored). Runs with or without tests.
echo "::group::copies"
if ! node -e '
  const fs = require("fs")
  const read = f => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n").split("\n")
  const tail = f => read(f).slice(1).join("\n") // all but the first-line header comment
  const fn = name => f => { // from "export const <name>" to the first "}" at column 0
    const lines = read(f), i = lines.findIndex(l => l.startsWith(`export const ${name} `))
    const j = i < 0 ? -1 : lines.findIndex((l, k) => k > i && l === "}")
    return i < 0 || j < 0 ? null : lines.slice(i, j + 1).join("\n")
  }
  const line = prefix => f => read(f).find(l => l.startsWith(prefix)) ?? null
  const pairs = [
    ["agent-flow/hooks/diff.ts", "change-tutor/hooks/diff.ts", tail, "body after line 1"],
    ["agent-flow/hooks/model.ts", "qhud/hooks/model.ts", fn("modelName"), "modelName"],
    ["agent-flow/types/index.d.ts", "change-tutor/types/index.d.ts", line("export type Hunk ="), "type Hunk"],
  ]
  let bad = 0
  for (const [a, b, pick, what] of pairs) {
    const x = pick(a), y = pick(b)
    if (x === null || y === null) { console.error(`check: ${what} not found in ${x === null ? a : b}`); bad++ }
    else if (x !== y) { console.error(`check: ${a} and ${b} differ (${what})`); bad++ }
  }
  process.exit(bad ? 1 : 0)
'; then failed+=("copies"); fi
echo "::endgroup::"

# Every plugin source the marketplace lists, and any version mismatch with its plugin.json.
sources=$(node -e '
  const fs = require("fs"), path = require("path")
  const m = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"))
  let bad = 0
  for (const p of m.plugins) {
    const own = JSON.parse(fs.readFileSync(path.join(p.source, ".claude-plugin/plugin.json"), "utf8"))
    if (own.name !== p.name) { console.error(`check: ${p.source}: name ${own.name} != marketplace ${p.name}`); bad++ }
    if (own.version !== p.version) { console.error(`check: ${p.name}: plugin.json ${own.version} != marketplace.json ${p.version}`); bad++ }
    console.log(p.source)
  }
  process.exit(bad ? 1 : 0)
')

for src in $sources; do
  echo "::group::validate ${src}"
  if ! claude plugin validate "$src"; then failed+=("validate ${src}"); fi
  echo "::endgroup::"
  if $run_tests; then
    echo "::group::test ${src}"
    if ! claude plugin test "$src"; then failed+=("test ${src}"); fi
    echo "::endgroup::"
  fi
done

if [ ${#failed[@]} -gt 0 ]; then
  printf 'check: FAILED: %s\n' "${failed[@]}" >&2
  exit 1
fi
echo "check: all plugins passed$($run_tests || echo ' (validate only)')"
