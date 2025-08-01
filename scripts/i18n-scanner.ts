// scripts/i18n-scanner.ts
import fs from "node:fs/promises";
import path from "node:path";
import * as babelParser from "@babel/parser";
import traverse from "@babel/traverse";
import * as vueCompiler from "@vue/compiler-sfc";
import type { Node as BabelNode } from "@babel/types";

const SCAN_DIRECTORY = "apps/frontend-vueflow/src"; // 扫描目录，查找需要国际化的键
const LANG_DIR = "apps/frontend-vueflow/src/locales"; // 内置语言目录
const MERGED_OUTPUT_DIR = "scripts/merged_locales"; // 内置语言合并输出目录
const EXTENSIONS_LANG_DIR = "locales-extensions"; // 扩展语言目录
const MERGED_EXTENSIONS_OUTPUT_DIR = "locales-extensions/merged_locales"; // 扩展语言合并输出目录
const OUTPUT_TEMPLATE_FILE = "scripts/locales-template.json"; // 输出模板文件
const FILE_EXTENSIONS = [".vue", ".ts"]; // 扫描的文件类型的文件扩展名

// --- AST Traversal and Key Extraction ---

function extractStringLiteralsFromBabel(
  node: BabelNode | null | undefined,
  keys: Set<string>
): void {
  if (!node) return;

  switch (node.type) {
    case "StringLiteral":
      keys.add(node.value);
      break;
    case "ConditionalExpression":
      extractStringLiteralsFromBabel(node.consequent, keys);
      extractStringLiteralsFromBabel(node.alternate, keys);
      break;
    case "LogicalExpression":
      extractStringLiteralsFromBabel(node.left, keys);
      extractStringLiteralsFromBabel(node.right, keys);
      break;
    case "TemplateLiteral":
      node.expressions.forEach((expr) => {
        extractStringLiteralsFromBabel(expr, keys);
      });
      break;
    case "Identifier":
    case "MemberExpression":
      // We can't statically resolve variables, so we ignore them.
      // This is a limitation of this script.
      break;
  }
}

function extractKeysFromJS(content: string, isExpression: boolean = false): Set<string> {
  const keys = new Set<string>();
  if (!content.trim()) return keys;

  // Wrap expression in parentheses to help Babel parse it correctly.
  const codeToParse = isExpression ? `(${content})` : content;

  try {
    const ast = babelParser.parse(codeToParse, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    });

    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        let isTCall = false;

        if (callee.type === "Identifier" && (callee.name === "t" || callee.name === "$t")) {
          isTCall = true;
        } else if (
          callee.type === "MemberExpression" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "t"
        ) {
          // 捕获 this.t(...), i18n.global.t(...) 等调用
          isTCall = true;
        }

        if (isTCall) {
          const firstArg = path.node.arguments[0];
          if (
            firstArg &&
            firstArg.type !== "SpreadElement" &&
            firstArg.type !== "ArgumentPlaceholder"
          ) {
            extractStringLiteralsFromBabel(firstArg, keys);
          }
        }
      },

      ObjectProperty(path) {
        const keyNode = path.node.key;
        const valueNode = path.node.value;

        // 扫描诸如 labelKey: 'path.to.key' 之类的属性
        const I18N_KEY_PROPS = new Set([
          "labelKey",
          "titleKey",
          "messageKey",
          "placeholderKey",
          "label",
          "title",
          "message",
          "placeholder",
          "text",
          "header",
          "content",
          "name",
        ]);

        if (
          keyNode.type === "Identifier" &&
          I18N_KEY_PROPS.has(keyNode.name) &&
          valueNode.type === "StringLiteral" &&
          valueNode.value.includes(".") // 基本启发式规则：i18n key 通常包含'.'
        ) {
          keys.add(valueNode.value);
        }
      },
    });
  } catch (e) {
    // console.error(`Babel parsing error for content: ${content}`, e);
  }
  return keys;
}

function extractKeysFromTemplate(templateContent: string): Set<string> {
  const keys = new Set<string>();
  // Regex to find t('...') or $t('...') calls
  const tCallRegex = /(?:\bt|\$t)\s*\(([^)]+)\)/g;
  // Regex to find string literals inside the call arguments
  const stringLiteralRegex = /(['"`])((?:\\.|(?!\1).)*?)\1/g;

  let match;
  while ((match = tCallRegex.exec(templateContent)) !== null) {
    const argsContent = match[1];
    if (argsContent) {
      let literalMatch;
      while ((literalMatch = stringLiteralRegex.exec(argsContent)) !== null) {
        // literalMatch[2] is the captured string content
        if (literalMatch[2]) {
          keys.add(literalMatch[2]);
        }
      }
    }
  }
  return keys;
}

function extractKeysFromVue(content: string): Set<string> {
  const keys = new Set<string>();
  const { descriptor } = vueCompiler.parse(content);

  // Use AST parsing for scripts (more reliable)
  if (descriptor.script) {
    extractKeysFromJS(descriptor.script.content).forEach((key) => keys.add(key));
  }
  if (descriptor.scriptSetup) {
    extractKeysFromJS(descriptor.scriptSetup.content).forEach((key) => keys.add(key));
  }

  // Use robust regex for templates (avoids parsing isolated expressions)
  if (descriptor.template) {
    extractKeysFromTemplate(descriptor.template.content).forEach((key) => keys.add(key));
  }

  return keys;
}

// --- File System and JSON Manipulation (unchanged) ---

interface NestedObject {
  [key: string]: string | NestedObject;
}
interface DiffResult {
  added: string[];
  obsolete: string[];
}
async function findFiles(dir: string, extensions: string[]): Promise<string[]> {
  let files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist")
          continue;
        files = files.concat(await findFiles(fullPath, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return files;
}
function keysToNestedObject(keysSet: Set<string>, valueForKey: string = "[TODO]"): NestedObject {
  const root: NestedObject = {};
  for (const key of Array.from(keysSet).sort()) {
    const parts = key.split(".");
    let currentLevel = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        if (typeof currentLevel[part] === "object" && currentLevel[part] !== null) {
          console.warn(
            `Warning: Key path conflict during template generation. '${key}' might overwrite an existing object at '${part}'.`
          );
        }
        currentLevel[part] = valueForKey;
      } else {
        if (!currentLevel[part] || typeof currentLevel[part] === "string") {
          currentLevel[part] = {};
        }
        currentLevel = currentLevel[part] as NestedObject;
      }
    });
  }
  return root;
}
function getAllLeafPaths(
  obj: NestedObject,
  currentPath: string = "",
  paths: Set<string> = new Set()
): Set<string> {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (currentPath === "" && key === "_meta" && typeof obj[key] === "object") {
        continue;
      }
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      if (typeof obj[key] === "string") {
        paths.add(newPath);
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        getAllLeafPaths(obj[key] as NestedObject, newPath, paths);
      }
    }
  }
  return paths;
}
function compareLangObjects(templateObj: NestedObject, existingLangObj: NestedObject): DiffResult {
  const templatePaths = getAllLeafPaths(templateObj);
  const existingPaths = getAllLeafPaths(existingLangObj);
  const added: string[] = [];
  templatePaths.forEach((path) => {
    if (!existingPaths.has(path)) {
      added.push(path);
    }
  });
  const obsolete: string[] = [];
  existingPaths.forEach((path) => {
    if (!templatePaths.has(path)) {
      obsolete.push(path);
    }
  });
  return { added: added.sort(), obsolete: obsolete.sort() };
}
function getValueByPath(obj: NestedObject, pathValue: string): string | NestedObject | undefined {
  const parts = pathValue.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) return undefined;

  let current: string | NestedObject | undefined = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as NestedObject)[part];
  }
  return current;
}

function setValueByPath(obj: NestedObject, pathValue: string, value: string): void {
  const parts = pathValue.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    console.warn(`setValueByPath: Invalid path '${pathValue}' - no valid parts found.`);
    return;
  }
  let currentLevel: NestedObject = obj;
  for (let i = 0; i < parts.length; i++) {
    const part: string = parts[i]!;
    if (i === parts.length - 1) {
      currentLevel[part] = value;
    } else {
      const nextLevel = currentLevel[part];
      if (typeof nextLevel !== "object" || nextLevel === null) {
        currentLevel[part] = {};
      }
      const potentialNextLevel = currentLevel[part];
      if (typeof potentialNextLevel === "object" && potentialNextLevel !== null) {
        currentLevel = potentialNextLevel as NestedObject;
      } else {
        console.warn(
          `setValueByPath: Failed to ensure object at segment '${part}' for path '${pathValue}'.`
        );
        return;
      }
    }
  }
}
function deleteValueByPath(obj: NestedObject, pathValue: string): boolean {
  const parts = pathValue.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    console.warn(`deleteValueByPath: Invalid path '${pathValue}' - no valid parts found.`);
    return false;
  }
  let currentLevel: NestedObject = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part: string = parts[i]!;
    const nextLevel = currentLevel[part];
    if (typeof nextLevel === "object" && nextLevel !== null) {
      currentLevel = nextLevel as NestedObject;
    } else {
      return false;
    }
  }
  const lastPart: string = parts[parts.length - 1]!;
  if (currentLevel.hasOwnProperty(lastPart)) {
    delete currentLevel[lastPart];
    return true;
  }
  return false;
}
function mergeTranslations(
  existingLangObj: NestedObject,
  finalTemplateObj: NestedObject
): NestedObject {
  // Start with a deep copy of the final template, which has the correct structure.
  const merged: NestedObject = JSON.parse(JSON.stringify(finalTemplateObj));

  // Get all the keys that should exist in the final file (this helper already skips _meta).
  const allKeys = getAllLeafPaths(finalTemplateObj);

  for (const keyPath of allKeys) {
    const existingValue = getValueByPath(existingLangObj, keyPath);
    // If an old value exists and it's a string, use it.
    // Otherwise, the [TODO] from the template remains.
    if (typeof existingValue === "string") {
      setValueByPath(merged, keyPath, existingValue);
    }
  }

  // Ensure the _meta block from the original file is preserved if it exists.
  if (existingLangObj._meta) {
    merged._meta = JSON.parse(JSON.stringify(existingLangObj._meta));
  }

  return merged;
}

// --- Main Execution ---

async function processLanguageDirectory({
  sourceDir,
  outputDir,
  scannedTemplateObject,
  finalTemplateObject,
}: {
  sourceDir: string;
  outputDir: string;
  scannedTemplateObject: NestedObject;
  finalTemplateObject: NestedObject;
}) {
  try {
    const localeFiles = await fs.readdir(sourceDir);
    if (localeFiles.length === 0) {
      // 如果目录为空，则不执行任何操作
      console.log(`\n语言目录 '${sourceDir}' 为空或不存在，跳过处理。`);
      return;
    }

    console.log(`\n--- 正在处理 '${sourceDir}' 中的语言文件 ---`);
    await fs.mkdir(outputDir, { recursive: true });

    for (const fileName of localeFiles) {
      if (path.extname(fileName) !== ".json") {
        console.log(`跳过非JSON文件: ${fileName}`);
        continue;
      }

      const filePath = path.join(sourceDir, fileName);
      const outputFilePath = path.join(outputDir, fileName);

      console.log(`\n--- 正在处理 ${fileName} ---`);

      let existingLangObject: NestedObject = {};
      try {
        const existingLangContent = await fs.readFile(filePath, "utf-8");
        existingLangObject = JSON.parse(existingLangContent);
      } catch (error) {
        console.warn(`! 警告: 无法读取 ${filePath}。将从模板创建一个新文件。`);
        // If file doesn't exist or is invalid, treat as empty object for comparison
      }

      // Generate and display diff report
      const { _meta, ...content } = existingLangObject;
      const diffResult = compareLangObjects(scannedTemplateObject, content as NestedObject);

      console.log("比较报告:");
      console.log(`  新增的 Key: ${diffResult.added.length}`);
      if (diffResult.added.length > 0) {
        diffResult.added.forEach((key) => console.log(`    + ${key}`));
      }

      console.log(`  过时的 Key: ${diffResult.obsolete.length}`);
      if (diffResult.obsolete.length > 0) {
        diffResult.obsolete.forEach((key) => console.log(`    - ${key}`));
      }

      // Merge and write the file
      const mergedTranslations = mergeTranslations(existingLangObject, finalTemplateObject);

      try {
        await fs.writeFile(outputFilePath, JSON.stringify(mergedTranslations, null, 2), "utf-8");
        console.log(`  -> 已将合并后的文件写入 ${path.resolve(outputFilePath)}`);
      } catch (error) {
        console.error(`  -> 写入合并文件 ${fileName} 时出错:`, error);
      }
    }
    console.log(`\n'${sourceDir}' 中的所有文件已处理完毕。产物位于 ${path.resolve(outputDir)}`);
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.error(`处理语言目录 ${sourceDir} 时发生错误:`, error);
    } else {
      console.log(`\n语言目录 '${sourceDir}' 不存在，跳过。`);
    }
  }
}

async function main() {
  console.log(
    `Scanning for i18n keys in ${SCAN_DIRECTORY} for files ending with ${FILE_EXTENSIONS.join(
      ", "
    )}...`
  );
  const filesToScan = await findFiles(SCAN_DIRECTORY, FILE_EXTENSIONS);
  console.log(`Found ${filesToScan.length} files to scan.`);

  const allKeys = new Set<string>();
  for (const filePath of filesToScan) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      let keysInFile: Set<string>;
      if (filePath.endsWith(".vue")) {
        keysInFile = extractKeysFromVue(content);
      } else {
        keysInFile = extractKeysFromJS(content);
      }
      keysInFile.forEach((key) => allKeys.add(key));
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  // --- Key Filtering ---
  const INVALID_KEYS_BLACKLIST = new Set(["dark", "list", "system", "component"]);
  const filteredKeys = new Set<string>();
  for (const key of allKeys) {
    // Basic filtering rules:
    // - Must contain a dot (standard for our nested keys)
    // - Must be longer than 3 characters
    // - Must not be in the blacklist
    // - Must contain at least one letter
    if (
      key.includes(".") &&
      key.length > 3 &&
      !INVALID_KEYS_BLACKLIST.has(key) &&
      /[a-zA-Z]/.test(key)
    ) {
      filteredKeys.add(key);
    }
  }

  console.log(
    `\nFound ${allKeys.size} unique i18n keys from scan, ${filteredKeys.size} after filtering.`
  );
  const scannedTemplateObject = keysToNestedObject(filteredKeys);

  // Create a new object with _meta first to ensure it appears at the top
  const finalTemplateObject = {
    _meta: {
      name: "[TODO: English name for the language, e.g., French (France)]",
      nativeName: "[TODO: Native name for the language, e.g., Français (France)]",
    },
    ...scannedTemplateObject,
  };

  try {
    await fs.mkdir(path.dirname(OUTPUT_TEMPLATE_FILE), { recursive: true });
    await fs.writeFile(OUTPUT_TEMPLATE_FILE, JSON.stringify(finalTemplateObject, null, 2), "utf-8");
    console.log(`\nScanned keys template written to ${path.resolve(OUTPUT_TEMPLATE_FILE)}`);
  } catch (error) {
    console.error(`Error writing scanned template file:`, error);
  }

  // --- Language File Merging and Reporting ---
  await processLanguageDirectory({
    sourceDir: LANG_DIR,
    outputDir: MERGED_OUTPUT_DIR,
    scannedTemplateObject,
    finalTemplateObject,
  });

  await processLanguageDirectory({
    sourceDir: EXTENSIONS_LANG_DIR,
    outputDir: MERGED_EXTENSIONS_OUTPUT_DIR,
    scannedTemplateObject,
    finalTemplateObject,
  });

  console.log(`\n处理完成。请分别检查以下目录中的合并产物:`);
  console.log(`- 内置语言: ${path.resolve(MERGED_OUTPUT_DIR)}`);
  console.log(`- 扩展语言: ${path.resolve(MERGED_EXTENSIONS_OUTPUT_DIR)}`);
  console.log("\n注意：新增的翻译条目会以 '[TODO]' 作为默认值，请在合并后的文件中让 AI、LLM 来自动翻译todo项，或者手动进行翻译处理。");
  console.log("\n请在确认条目内容无误后，运行 `bun run i18n:copy`，将内置产物覆盖到 'apps/frontend-vueflow/src/locales' 目录。");
}

main().catch(console.error);
