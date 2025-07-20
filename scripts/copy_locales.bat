@echo off
chcp 65001
setlocal

echo 正在复制语言环境文件...

REM 获取脚本所在的目录
set "SCRIPT_DIR=%~dp0"

REM 定义源路径和目标路径
REM 源目录就在脚本旁边
set "SOURCE_DIR=%SCRIPT_DIR%merged_locales"
REM 目标目录需要从脚本目录向上返回一级，然后进入apps...
set "DEST_DIR=%SCRIPT_DIR%..\apps\frontend-vueflow\src\locales"

echo 源目录: %SOURCE_DIR%
echo 目标目录: %DEST_DIR%

REM 检查源目录是否存在
if not exist "%SOURCE_DIR%" (
    echo 错误：源目录 "%SOURCE_DIR%" 不存在。
    pause
    exit /b 1
)

REM 检查目标目录是否存在，如果不存在则创建
if not exist "%DEST_DIR%" (
    echo 目标目录不存在，正在创建: %DEST_DIR%
    mkdir "%DEST_DIR%"
)

REM 使用 xcopy 复制所有 .json 文件
REM /Y: 禁止提示确认覆盖现有目标文件。
REM /I: 如果目标不存在并且要复制多个文件，则假定目标必须是目录。
REM /F: 复制时显示完整的源文件名和目标文件名。
xcopy "%SOURCE_DIR%\*.json" "%DEST_DIR%\" /Y /I /F

echo.
echo 语言环境文件已成功复制！
endlocal