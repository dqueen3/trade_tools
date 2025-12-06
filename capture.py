#!/usr/bin/env python3
import sys
import subprocess
from datetime import datetime

if len(sys.argv) < 2:
    print("Usage: python3 capture.py <WINDOW_ID>")
    sys.exit(1)

window_id = sys.argv[1]

output = f"/Users/kawafmm/workspace/trade_tool/stocks/hypersbi_{datetime.now():%Y%m%d_%H%M%S}.png"
cmd = ["/usr/sbin/screencapture", "-x", "-l", window_id, output]

subprocess.run(cmd)
print(f"📁 Saved → {output}")
