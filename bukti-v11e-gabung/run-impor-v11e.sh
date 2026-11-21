#!/bin/bash
set -u
BASE=/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung
BUKTI="$BASE/bukti-v11e-gabung"
rm -rf "$BUKTI/userdata-impor"
export STUDIO_CAPTURE_PLAN="$BUKTI/plan-impor-v11e.json"
export STUDIO_USER_DATA="$BUKTI/userdata-impor"
export STUDIO_LOG="$BUKTI/05-impor.log"
export ELECTRON_DISABLE_SANDBOX=1
cd "$BASE" || exit 1
xvfb-run -a npm run dev > "$BUKTI/05-impor-dev.log" 2>&1
echo "IMPOR_EXIT=$?"
grep -h -E 'IMPOR-' "$STUDIO_LOG" || true
