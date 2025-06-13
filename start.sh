#!/bin/bash

echo "正在启动 ComfyTavern..."
echo "检查系统代理设置..."

# 检查已有的环境变量
if [ -n "$http_proxy" ] || [ -n "$HTTP_PROXY" ] || [ -n "$https_proxy" ] || [ -n "$HTTPS_PROXY" ]; then
    echo "检测到已设置的代理环境变量:"
    [ -n "$http_proxy" ] && echo "  http_proxy=$http_proxy"
    [ -n "$HTTP_PROXY" ] && echo "  HTTP_PROXY=$HTTP_PROXY"
    [ -n "$https_proxy" ] && echo "  https_proxy=$https_proxy"
    [ -n "$HTTPS_PROXY" ] && echo "  HTTPS_PROXY=$HTTPS_PROXY"
else
    PROXY_DETECTED=false
    # 尝试 gsettings (GNOME)
    if command -v gsettings &> /dev/null; then
        PROXY_MODE=$(gsettings get org.gnome.system.proxy mode 2>/dev/null)
        if [ "$PROXY_MODE" = "'manual'" ]; then
            HTTP_HOST=$(gsettings get org.gnome.system.proxy.http host 2>/dev/null | tr -d "'")
            HTTP_PORT=$(gsettings get org.gnome.system.proxy.http port 2>/dev/null)
            if [ -n "$HTTP_HOST" ] && [ -n "$HTTP_PORT" ] && [ "$HTTP_PORT" -ne 0 ]; then
                export http_proxy="http://$HTTP_HOST:$HTTP_PORT"
                export https_proxy="http://$HTTP_HOST:$HTTP_PORT" # 假设 https 也用此代理
                echo "通过 gsettings 获取到代理: $http_proxy"
                PROXY_DETECTED=true
            fi
        fi
    fi

    # 尝试 scutil (macOS)
    if ! $PROXY_DETECTED && [ "$(uname)" = "Darwin" ] && command -v scutil &> /dev/null; then
        PROXY_SETTINGS=$(scutil --proxy)
        HTTP_ENABLED=$(echo "$PROXY_SETTINGS" | grep "HTTPEnable" | awk '{print $3}')
        HTTPS_ENABLED=$(echo "$PROXY_SETTINGS" | grep "HTTPSEnable" | awk '{print $3}')

        if [ "$HTTP_ENABLED" = "1" ]; then
            HTTP_HOST=$(echo "$PROXY_SETTINGS" | grep "HTTPProxy" | awk '{print $3}')
            HTTP_PORT=$(echo "$PROXY_SETTINGS" | grep "HTTPPort" | awk '{print $3}')
            if [ -n "$HTTP_HOST" ] && [ -n "$HTTP_PORT" ]; then
                export http_proxy="http://$HTTP_HOST:$HTTP_PORT"
                echo "通过 scutil 获取到 HTTP 代理: $http_proxy"
                PROXY_DETECTED=true
            fi
        fi
        if [ "$HTTPS_ENABLED" = "1" ]; then
            HTTPS_HOST=$(echo "$PROXY_SETTINGS" | grep "HTTPSProxy" | awk '{print $3}')
            HTTPS_PORT=$(echo "$PROXY_SETTINGS" | grep "HTTPSPort" | awk '{print $3}')
            if [ -n "$HTTPS_HOST" ] && [ -n "$HTTPS_PORT" ]; then
                export https_proxy="http://$HTTPS_HOST:$HTTPS_PORT" # scutil 通常分别设置 http 和 https
                echo "通过 scutil 获取到 HTTPS 代理: $https_proxy"
                PROXY_DETECTED=true
            else # 如果 HTTPSProxy 未明确设置，但 HTTP 代理已设置，则尝试复用
                if [ -n "$http_proxy" ] && [ -z "$https_proxy" ]; then
                    export https_proxy="$http_proxy"
                    echo "HTTPS 代理复用 HTTP 代理: $https_proxy"
                fi
            fi
        elif [ -n "$http_proxy" ] && [ -z "$https_proxy" ]; then # 如果 HTTPSEnable 不是1，但 http_proxy 已设置
            export https_proxy="$http_proxy"
            echo "HTTPS 代理复用 HTTP 代理: $https_proxy"
        fi
    fi

    if $PROXY_DETECTED; then
        [ -n "$http_proxy" ] && echo "已设置 http_proxy=$http_proxy"
        [ -n "$https_proxy" ] && echo "已设置 https_proxy=$https_proxy"
    else
        echo "未能自动获取系统代理。如果需要，请手动设置 http_proxy 和 https_proxy 环境变量。"
    fi
fi
echo ""


if ! command -v bun &> /dev/null; then
    echo "错误：未安装 bun 或未在 PATH 中"
    echo "请先安装 bun：https://bun.sh"
    exit 1
fi

echo "正在准备项目环境 (如果数据库不存在，将进行设置)..."
bun run prepare:project
if [ $? -ne 0 ]; then
    echo "错误：项目准备步骤失败"
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