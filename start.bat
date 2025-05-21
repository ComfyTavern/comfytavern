@echo off
setlocal enabledelayedexpansion
chcp 65001
echo 正在启动 ComfyTavern...

echo 检查系统代理设置...
set HTTP_PROXY=
set HTTPS_PROXY=

FOR /F "tokens=2*" %%A IN ('reg query "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable 2^>nul ^| find "REG_DWORD"') DO SET ProxyEnable=%%B
IF DEFINED ProxyEnable (
    IF "%ProxyEnable%"=="0x1" (
        FOR /F "tokens=2*" %%A IN ('reg query "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer 2^>nul ^| find "REG_SZ"') DO SET ProxyServerValue=%%B
        IF DEFINED ProxyServerValue (
            echo 系统代理已启用，代理服务器: !ProxyServerValue!
            REM 检查是否包含协议头，如果没有则添加 http://
            echo !ProxyServerValue! | findstr /R /C:"^[a-zA-Z]*://" >nul
            if errorlevel 1 (
                set PROXY_URL=http://!ProxyServerValue!
            ) else (
                set PROXY_URL=!ProxyServerValue!
            )
            set HTTP_PROXY=!PROXY_URL!
            set HTTPS_PROXY=!PROXY_URL!
            echo HTTP_PROXY 和 HTTPS_PROXY 已设置为: !PROXY_URL!
        ) ELSE (
            echo 系统代理已启用，但未能获取到代理服务器地址。
        )
    ) ELSE (
        echo 系统代理未启用。
    )
) ELSE (
    echo 未能获取到系统代理启用状态。
)
echo.

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