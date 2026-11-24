#!/bin/bash
set -u
BASE=/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung
BUKTI="$BASE/bukti-v11e-gabung"
rm -rf "$BUKTI/userdata-fitur"
export STUDIO_CAPTURE_PLAN="$BUKTI/plan-ui-fitur-v11e.json"
export STUDIO_USER_DATA="$BUKTI/userdata-fitur"
export STUDIO_LOG="$BUKTI/07-ui-fitur.log"
export ELECTRON_DISABLE_SANDBOX=1
cd "$BASE" || exit 1
xvfb-run -a npm run dev > "$BUKTI/07-ui-fitur-dev.log" 2>&1
echo "UI_FITUR_EXIT=$?"
grep -h -E 'FITUR-' "$STUDIO_LOG" || true
