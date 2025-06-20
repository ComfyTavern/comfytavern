// scripts/i18n-scanner.ts
import fs from 'node:fs/promises';
import path from 'node:path';

const SCAN_DIRECTORY = 'apps/frontend-vueflow/src';
const EXISTING_LANG_FILE = 'apps/frontend-vueflow/src/locales/zh-CN.json';
const OUTPUT_TEMPLATE_FILE = 'scripts/locales-template.json';
const OUTPUT_MERGED_FILE = 'scripts/zh-CN.merged.json';
const FILE_EXTENSIONS = ['.vue', '.ts'];

// 正则表达式匹配 t('key') 或 $t('key')
// 支持单引号或双引号，key可以包含字母数字、下划线、点、短横线
// \b确保t是独立的单词，避免匹配类似setTimeout的情况
const I18N_KEY_REGEX_T = /\bt\s*\(\s*['"]([\w.-]+)['"]\s*(?:,[^)]*)?\s*\)/g;
const I18N_KEY_REGEX_DOLLAR_T = /\$t\s*\(\s*['"]([\w.-]+)['"]\s*(?:,[^)]*)?\s*\)/g;

interface NestedObject {
  [key: string]: string | NestedObject;
}

interface DiffResult {
  added: string[];
  obsolete: string[];
}

/**
 * 递归扫描目录以查找具有特定扩展名的文件。
 * @param dir 要扫描的目录。
 * @param extensions 要查找的文件扩展名数组 (例如 ['.vue', '.ts'])。
 * @returns 文件路径数组。
 */
async function findFiles(dir: string, extensions: string[]): Promise<string[]> {
  let files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue; // 跳过常见目录
        files = files.concat(await findFiles(fullPath, extensions));
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return files;
}

/**
 * 从给定内容中提取 i18n 键。
 * @param content 文件内容。
 * @returns 提取到的 i18n 键集合。
 */
function extractI18nKeys(content: string): Set<string> {
  const keys = new Set<string>();
  let match;

  while ((match = I18N_KEY_REGEX_T.exec(content)) !== null) {
    if (match[1]) keys.add(match[1]);
  }
  I18N_KEY_REGEX_T.lastIndex = 0;

  while ((match = I18N_KEY_REGEX_DOLLAR_T.exec(content)) !== null) {
    if (match[1]) keys.add(match[1]);
  }
  I18N_KEY_REGEX_DOLLAR_T.lastIndex = 0;

  return keys;
}

/**
 * 将扁平化的 i18n 键列表 (例如 "a.b.c") 转换为嵌套对象。
 * @param keysSet 包含 i18n 键的 Set。
 * @param valueForKey 新键的默认值。
 * @returns 嵌套的 JSON 对象。
 */
function keysToNestedObject(keysSet: Set<string>, valueForKey: string = "[TODO]"): NestedObject {
  const root: NestedObject = {};
  for (const key of Array.from(keysSet).sort()) {
    const parts = key.split('.');
    let currentLevel = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        if (typeof currentLevel[part] === 'object' && currentLevel[part] !== null) {
          console.warn(`Warning: Key path conflict during template generation. '${key}' might overwrite an existing object at '${part}'.`);
        }
        currentLevel[part] = valueForKey;
      } else {
        if (!currentLevel[part] || typeof currentLevel[part] === 'string') {
          currentLevel[part] = {};
        }
        currentLevel = currentLevel[part] as NestedObject;
      }
    });
  }
  return root;
}

function getAllLeafPaths(obj: NestedObject, currentPath: string = '', paths: Set<string> = new Set()): Set<string> {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // 忽略 _meta 键的子路径收集，但允许 _meta 本身作为路径（如果它是字符串）
      if (currentPath === '' && key === '_meta' && typeof obj[key] === 'object') {
        continue;
      }
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      if (typeof obj[key] === 'string') {
        paths.add(newPath);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
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
  templatePaths.forEach(path => {
    if (!existingPaths.has(path)) {
      added.push(path);
    }
  });

  const obsolete: string[] = [];
  existingPaths.forEach(path => {
    if (!templatePaths.has(path)) {
      obsolete.push(path);
    }
  });

  return { added: added.sort(), obsolete: obsolete.sort() };
}

function setValueByPath(obj: NestedObject, pathValue: string, value: string): void {
  const parts = pathValue.split('.').filter(part => part.length > 0); // 过滤空字符串
  if (parts.length === 0) {
    console.warn(`setValueByPath: Invalid path '${pathValue}' - no valid parts found.`);
    return;
  }
  
  let currentLevel: NestedObject = obj;

  for (let i = 0; i < parts.length; i++) {
    const part: string = parts[i]!; // 使用非空断言，因为我们已经过滤了空字符串
    if (i === parts.length - 1) {
      // 这是路径的最后一部分，直接赋值
      currentLevel[part] = value;
    } else {
      // 这不是路径的最后一部分，需要确保下一层是对象
      const nextLevel = currentLevel[part];
      if (typeof nextLevel !== 'object' || nextLevel === null) {
        // 如果下一层不是对象（可能是 undefined, null, 或 string），
        // 我们将其创建/重置为空对象。
        // 这可能会覆盖一个预先存在的字符串值，如果路径设计不当。
        currentLevel[part] = {};
      }
      // 断言 currentLevel[part] 现在是一个对象，然后进入下一层
      // TypeScript 可能仍然需要断言，因为之前的赋值是 `string | NestedObject`
      const potentialNextLevel = currentLevel[part];
      if (typeof potentialNextLevel === 'object' && potentialNextLevel !== null) {
          currentLevel = potentialNextLevel as NestedObject;
      } else {
          // 如果在这里 potentialNextLevel 仍然不是对象，说明上面的 currentLevel[part] = {} 可能由于某种原因未按预期工作
          // 或者类型系统无法完全跟踪。这是一个防御性检查。
          console.warn(`setValueByPath: Failed to ensure object at segment '${part}' for path '${pathValue}'.`);
          return;
      }
    }
  }
}

function deleteValueByPath(obj: NestedObject, pathValue: string): boolean {
    const parts = pathValue.split('.').filter(part => part.length > 0); // 过滤空字符串
    if (parts.length === 0) {
        console.warn(`deleteValueByPath: Invalid path '${pathValue}' - no valid parts found.`);
        return false;
    }
    
    let currentLevel: NestedObject = obj;
    
    // 遍历到倒数第二个部分，以获取父对象
    for (let i = 0; i < parts.length - 1; i++) {
        const part: string = parts[i]!; // 使用非空断言
        const nextLevel = currentLevel[part];
        if (typeof nextLevel === 'object' && nextLevel !== null) {
            currentLevel = nextLevel as NestedObject;
        } else {
            // 路径中某一部分不存在或不是对象，无法删除
            // console.warn(`deleteValueByPath: Path segment '${part}' not found or not an object for path '${pathValue}'.`);
            return false;
        }
    }

    const lastPart: string = parts[parts.length - 1]!; // 使用非空断言
    // 现在 currentLevel 是包含要删除的键的父对象
    if (currentLevel.hasOwnProperty(lastPart)) {
        delete currentLevel[lastPart];
        return true;
    }
    // console.warn(`deleteValueByPath: Last part '${lastPart}' not found in parent for path '${pathValue}'.`);
    return false;
}


function mergeTranslations(
  existingLangObj: NestedObject,
  scannedTemplateObj: NestedObject, // The object generated from scanned keys, values are "[TODO]"
  diff: DiffResult,
  removeObsolete: boolean = true // Option to control removal of obsolete keys
): NestedObject {
  const merged: NestedObject = JSON.parse(JSON.stringify(existingLangObj)); // Deep clone

  // Add new keys
  for (const keyPath of diff.added) {
    // The value from scannedTemplateObject for new keys is typically "[TODO]"
    setValueByPath(merged, keyPath, "[TODO]");
  }

  // Remove obsolete keys if requested
  if (removeObsolete) {
    for (const keyPath of diff.obsolete) {
      deleteValueByPath(merged, keyPath);
    }
  }
  // Note: The _meta field from existingLangObj is preserved due to the deep clone.
  // If scannedTemplateObj also had a _meta (which it currently doesn't),
  // specific merge logic for _meta might be needed if desired.
  return merged;
}


async function main() {
  console.log(`Scanning for i18n keys in ${SCAN_DIRECTORY} for files ending with ${FILE_EXTENSIONS.join(', ')}...`);
  const filesToScan = await findFiles(SCAN_DIRECTORY, FILE_EXTENSIONS);
  console.log(`Found ${filesToScan.length} files to scan.`);

  const allKeys = new Set<string>();
  for (const filePath of filesToScan) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const keysInFile = extractI18nKeys(content);
      keysInFile.forEach(key => allKeys.add(key));
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  console.log(`\nFound ${allKeys.size} unique i18n keys from scan.`);
  const scannedTemplateObject = keysToNestedObject(allKeys);

  try {
    await fs.mkdir(path.dirname(OUTPUT_TEMPLATE_FILE), { recursive: true });
    await fs.writeFile(OUTPUT_TEMPLATE_FILE, JSON.stringify(scannedTemplateObject, null, 2), 'utf-8');
    console.log(`\nScanned keys template written to ${path.resolve(OUTPUT_TEMPLATE_FILE)}`);
  } catch (error) {
    console.error(`Error writing scanned template file:`, error);
  }

  // Load existing language file
  let existingLangObject: NestedObject = {};
  try {
    const existingLangContent = await fs.readFile(EXISTING_LANG_FILE, 'utf-8');
    existingLangObject = JSON.parse(existingLangContent);
    console.log(`\nSuccessfully loaded existing language file: ${EXISTING_LANG_FILE}`);
  } catch (error) {
    console.error(`Error loading existing language file ${EXISTING_LANG_FILE}:`, error);
    console.log("Proceeding with an empty existing language object for comparison.");
  }
  
  // Compare and Merge
  // We need to be careful with _meta. The compare function should ignore it for obsolescence.
  // The getAllLeafPaths function was updated to mostly ignore _meta's children for path generation.
  const { _meta: existingMeta, ...existingContent } = existingLangObject;
  const diffResult = compareLangObjects(scannedTemplateObject, existingContent as NestedObject);

  console.log("\n--- Comparison Report ---");
  console.log(`Added keys (${diffResult.added.length}):`);
  diffResult.added.forEach(key => console.log(`  + ${key}`));

  console.log(`\nObsolete keys in ${EXISTING_LANG_FILE} (${diffResult.obsolete.length}):`);
  diffResult.obsolete.forEach(key => console.log(`  - ${key}`));
  console.log("-------------------------\n");

  // Merge (removeObsolete = true by default, change if needed)
  const mergedTranslations = mergeTranslations(existingLangObject, scannedTemplateObject, diffResult, true);
  
  try {
    await fs.writeFile(OUTPUT_MERGED_FILE, JSON.stringify(mergedTranslations, null, 2), 'utf-8');
    console.log(`Merged translations written to ${path.resolve(OUTPUT_MERGED_FILE)}`);
    console.log(`Please review ${OUTPUT_MERGED_FILE} and then you can replace your original language file if satisfied.`);
  } catch (error) {
    console.error(`Error writing merged file:`, error);
  }

  console.log("\nProcess complete.");
}

main().catch(console.error);