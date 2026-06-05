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
  --metadata title="Cardon Capstone Proposal" \
  -o cardon-proposal.html

"$CHROME_BIN" \
  --headless \
  --disable-gpu \
  --no-pdf-header-footer \
  --no-sandbox \
  --print-to-pdf="$DOCS/cardon-proposal.pdf" \
  "file://$DOCS/cardon-proposal.html"

echo "wrote $DOCS/cardon-proposal.pdf"
