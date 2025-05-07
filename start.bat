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

if "%1"=="dev" (
    bun run server.ts dev
) else (
    bun run build && bun run server.ts
)