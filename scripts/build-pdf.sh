#!/usr/bin/env bash
# Render docs/CAPSTONE_PROPOSAL.md to a single PDF using pandoc + Chrome headless.
# Requires: pandoc, Google Chrome.app on macOS (or set CHROME_BIN for other OSes).

set -euo pipefail

CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
DOCS="$(cd "$(dirname "$0")/../docs" && pwd)"

cd "$DOCS"

pandoc CAPSTONE_PROPOSAL.md \
  --standalone \
  --embed-resources \
  --css=proposal.css \
  --metadata title="Cordon Capstone Proposal" \
  -o cordon-proposal.html

"$CHROME_BIN" \
  --headless \
  --disable-gpu \
  --no-pdf-header-footer \
  --no-sandbox \
  --print-to-pdf="$DOCS/cordon-proposal.pdf" \
  "file://$DOCS/cordon-proposal.html"

echo "wrote $DOCS/cordon-proposal.pdf"
