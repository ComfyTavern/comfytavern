// scripts/i18n-scanner.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';
import * as vueCompiler from '@vue/compiler-sfc';
import type { Node as BabelNode } from '@babel/types';
import type { Node as VueNode, ElementNode, InterpolationNode, AttributeNode, DirectiveNode, SimpleExpressionNode } from '@vue/compiler-core';

const SCAN_DIRECTORY = 'apps/frontend-vueflow/src';
const EXISTING_LANG_FILE = 'apps/frontend-vueflow/src/locales/zh-CN.json';
const OUTPUT_TEMPLATE_FILE = 'scripts/locales-template.json';
const OUTPUT_MERGED_FILE = 'scripts/zh-CN.merged.json';
const FILE_EXTENSIONS = ['.vue', '.ts'];

// --- AST Traversal and Key Extraction ---

function extractStringLiteralsFromBabel(node: BabelNode | null | undefined, keys: Set<string>): void {
  if (!node) return;

  switch (node.type) {
    case 'StringLiteral':
      keys.add(node.value);
      break;
    case 'ConditionalExpression':
      extractStringLiteralsFromBabel(node.consequent, keys);
      extractStringLiteralsFromBabel(node.alternate, keys);
      break;
    case 'LogicalExpression':
      extractStringLiteralsFromBabel(node.left, keys);
      extractStringLiteralsFromBabel(node.right, keys);
      break;
    case 'TemplateLiteral':
      node.expressions.forEach(expr => {
        extractStringLiteralsFromBabel(expr, keys)
      });
      break;
    case 'Identifier':
    case 'MemberExpression':
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
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });

    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        let isTCall = false;

        if (callee.type === 'Identifier' && (callee.name === 't' || callee.name === '$t')) {
          isTCall = true;
        } else if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 't'
        ) {
          // 捕获 this.t(...), i18n.global.t(...) 等调用
          isTCall = true;
        }

        if (isTCall) {
          const firstArg = path.node.arguments[0];
          if (firstArg && firstArg.type !== 'SpreadElement' && firstArg.type !== 'ArgumentPlaceholder') {
            extractStringLiteralsFromBabel(firstArg, keys);
          }
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
    extractKeysFromJS(descriptor.script.content).forEach(key => keys.add(key));
  }
  if (descriptor.scriptSetup) {
    extractKeysFromJS(descriptor.scriptSetup.content).forEach(key => keys.add(key));
  }

  // Use robust regex for templates (avoids parsing isolated expressions)
  if (descriptor.template) {
    extractKeysFromTemplate(descriptor.template.content).forEach(key => keys.add(key));
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
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
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
  const parts = pathValue.split('.').filter(part => part.length > 0);
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
      if (typeof nextLevel !== 'object' || nextLevel === null) {
        currentLevel[part] = {};
      }
      const potentialNextLevel = currentLevel[part];
      if (typeof potentialNextLevel === 'object' && potentialNextLevel !== null) {
        currentLevel = potentialNextLevel as NestedObject;
      } else {
        console.warn(`setValueByPath: Failed to ensure object at segment '${part}' for path '${pathValue}'.`);
        return;
      }
    }
  }
}
function deleteValueByPath(obj: NestedObject, pathValue: string): boolean {
  const parts = pathValue.split('.').filter(part => part.length > 0);
  if (parts.length === 0) {
    console.warn(`deleteValueByPath: Invalid path '${pathValue}' - no valid parts found.`);
    return false;
  }
  let currentLevel: NestedObject = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part: string = parts[i]!;
    const nextLevel = currentLevel[part];
    if (typeof nextLevel === 'object' && nextLevel !== null) {
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
  scannedTemplateObj: NestedObject,
  diff: DiffResult,
  removeObsolete: boolean = true
): NestedObject {
  const merged: NestedObject = JSON.parse(JSON.stringify(existingLangObj));
  for (const keyPath of diff.added) {
    setValueByPath(merged, keyPath, "[TODO]");
  }
  if (removeObsolete) {
    for (const keyPath of diff.obsolete) {
      deleteValueByPath(merged, keyPath);
    }
  }
  return merged;
}

// --- Main Execution ---

async function main() {
  console.log(`Scanning for i18n keys in ${SCAN_DIRECTORY} for files ending with ${FILE_EXTENSIONS.join(', ')}...`);
  const filesToScan = await findFiles(SCAN_DIRECTORY, FILE_EXTENSIONS);
  console.log(`Found ${filesToScan.length} files to scan.`);

  const allKeys = new Set<string>();
  for (const filePath of filesToScan) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      let keysInFile: Set<string>;
      if (filePath.endsWith('.vue')) {
        keysInFile = extractKeysFromVue(content);
      } else {
        keysInFile = extractKeysFromJS(content);
      }
      keysInFile.forEach(key => allKeys.add(key));
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  // --- Key Filtering ---
  const INVALID_KEYS_BLACKLIST = new Set(['dark', 'list', 'system', 'component']);
  const filteredKeys = new Set<string>();
  for (const key of allKeys) {
    // Basic filtering rules:
    // - Must contain a dot (standard for our nested keys)
    // - Must be longer than 3 characters
    // - Must not be in the blacklist
    // - Must contain at least one letter
    if (key.includes('.') && key.length > 3 && !INVALID_KEYS_BLACKLIST.has(key) && /[a-zA-Z]/.test(key)) {
      filteredKeys.add(key);
    }
  }

  console.log(`\nFound ${allKeys.size} unique i18n keys from scan, ${filteredKeys.size} after filtering.`);
  const scannedTemplateObject = keysToNestedObject(filteredKeys);

  try {
    await fs.mkdir(path.dirname(OUTPUT_TEMPLATE_FILE), { recursive: true });
    await fs.writeFile(OUTPUT_TEMPLATE_FILE, JSON.stringify(scannedTemplateObject, null, 2), 'utf-8');
    console.log(`\nScanned keys template written to ${path.resolve(OUTPUT_TEMPLATE_FILE)}`);
  } catch (error) {
    console.error(`Error writing scanned template file:`, error);
  }

  let existingLangObject: NestedObject = {};
  try {
    const existingLangContent = await fs.readFile(EXISTING_LANG_FILE, 'utf-8');
    existingLangObject = JSON.parse(existingLangContent);
    console.log(`\nSuccessfully loaded existing language file: ${EXISTING_LANG_FILE}`);
  } catch (error) {
    console.error(`Error loading existing language file ${EXISTING_LANG_FILE}:`, error);
    console.log("Proceeding with an empty existing language object for comparison.");
  }

  const { _meta: existingMeta, ...existingContent } = existingLangObject;
  const diffResult = compareLangObjects(scannedTemplateObject, existingContent as NestedObject);

  console.log("\n--- Comparison Report ---");
  console.log(`Added keys (${diffResult.added.length}):`);
  diffResult.added.forEach(key => console.log(`  + ${key}`));

  console.log(`\nObsolete keys in ${EXISTING_LANG_FILE} (${diffResult.obsolete.length}):`);
  diffResult.obsolete.forEach(key => console.log(`  - ${key}`));
  console.log("-------------------------\n");

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