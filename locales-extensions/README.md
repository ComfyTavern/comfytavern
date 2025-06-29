# 扩展语言包目录

此目录用于存放用户自定义的语言包文件（.json 格式）。

将你的语言包文件（例如 `fr-FR.json`, `de-DE.json` 等）直接放入此文件夹中，然后运行 `bun scripts/i18n-scanner.ts` 脚本。

脚本会自动处理此目录下的所有 `.json` 文件，并将合并后的结果输出到 `locales-extensions/merged_locales/` 目录中，而不会影响项目内置的语言包。

**注意**：此目录下的所有文件（除了本 README 文件）都已被 Git 忽略，不会被提交到版本库中。

---

# Extension Locales Directory

This directory is for user-defined language packs (.json format).

Place your language files (e.g., `fr-FR.json`, `de-DE.json`) directly into this folder, then run the `bun scripts/i18n-scanner.ts` script.

The script will automatically process all `.json` files in this directory and output the merged results to the `locales-extensions/merged_locales/` directory without affecting the project's built-in locales.

**Note**: All files in this directory (except for this README file) are ignored by Git and will not be committed to the repository.