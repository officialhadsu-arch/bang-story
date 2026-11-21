#!/bin/bash
set -u
BASE=/home/hatch/workspace/fase0-0.2a/bang-story-03-v11e-gabung
BUKTI="$BASE/bukti-v11e-gabung"
rm -rf "$BUKTI/userdata-ui"
node "$BASE/bukti-naskah-per-bagian/mock-llm.cjs" > "$BUKTI/07-mock-llm.log" 2>&1 &
MOCK_PID=$!
sleep 2
export STUDIO_CAPTURE_PLAN="$BUKTI/plan-naskah-ui-v11e.json"
export STUDIO_USER_DATA="$BUKTI/userdata-ui"
export STUDIO_LOG="$BUKTI/07-naskah-ui.log"
export ELECTRON_DISABLE_SANDBOX=1
cd "$BASE" || exit 1
xvfb-run -a npm run dev > "$BUKTI/07-naskah-ui-dev.log" 2>&1
echo "UI_NASKAH_EXIT=$?"
kill $MOCK_PID 2>/dev/null
grep -h -E 'UI-' "$STUDIO_LOG" || true
