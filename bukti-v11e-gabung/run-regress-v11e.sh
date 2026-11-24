#!/bin/bash
# Regresi ekspor gabung v1.1e: rencana plan-regress-v11e.json, userdata salinan
# baseline 0.6 (userdata-regress), output bukti-v11e-gabung/regress. Xvfb via xvfb-run -a.
set -u
BASE=/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung
BUKTI="$BASE/bukti-v11e-gabung"
export STUDIO_CAPTURE_PLAN="$BUKTI/plan-regress-v11e.json"
export STUDIO_USER_DATA="$BUKTI/userdata-regress"
export STUDIO_LOG="$BUKTI/06-regress.log"
export ELECTRON_DISABLE_SANDBOX=1
cd "$BASE" || exit 1
xvfb-run -a npm run dev > "$BUKTI/06-regress-dev.log" 2>&1
echo "REGRESS_EXIT=$?"
grep -h -E 'REGRESS-SELESAI|DEMO LAST|DEMO COUNT|P30-30KLIP LAST|P30-30KLIP COUNT|P30-4KLIP LAST|P30-4KLIP COUNT|P30-SPLIT LAST|P30-SPLIT COUNT' "$STUDIO_LOG" || true
