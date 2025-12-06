#!/bin/bash

source /Users/kawafmm/workspace/trade_tool/window.env

# Python 実行パス指定
PYTHON="/Users/kawafmm/.pyenv/shims/python3"

echo "📌 WINDOW_ID=$WINDOW_ID"

# ウィンドウIDを渡してキャプチャ実行
$PYTHON /Users/kawafmm/workspace/trade_tool/capture.py "$WINDOW_ID"
