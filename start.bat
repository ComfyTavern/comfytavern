@echo off
chcp 65001
echo 正在启动 ComfyTavern...

where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误：未安装 bun 或未在 PATH 中
    echo 请先安装 bun：https://bun.sh
    pause
    exit /b 1
)

echo 正在检查并安装依赖...
bun install
if %errorlevel% neq 0 (
    echo 错误：依赖安装失败
    pause
    exit /b 1
)

if "%1"=="dev" (
    bun run server.ts dev
) else (
    bun run build && bun run server.ts
)