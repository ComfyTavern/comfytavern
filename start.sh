#!/bin/bash

echo "正在启动 ComfyTavern..."

if ! command -v bun &> /dev/null; then
    echo "错误：未安装 bun 或未在 PATH 中"
    echo "请先安装 bun：https://bun.sh"
    exit 1
fi

echo "正在检查并安装依赖..."
bun install
if [ $? -ne 0 ]; then
    echo "错误：依赖安装失败"
    exit 1
fi

if [ "$1" = "dev" ]; then
    bun run server.ts dev
else
    bun run build && bun run server.ts
fi