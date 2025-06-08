/**
 * 定义支持的转义字符及其对应的实际字符。
 * Key: 用户输入的转义字符（不含反斜杠）
 * Value: 替换后的实际字符
 */
const ESCAPE_MAP: Record<string, string> = {
  'n': '\n', // 换行符
  't': '\t', // 制表符
  'r': '\r', // 回车符
  '"': '"',  // 双引号
  "'": "'",  // 单引号
  // 'b': '\b', // 退格 (不常用，按需添加)
  // 'f': '\f', // 换页 (不常用，按需添加)
  // 'v': '\v', // 垂直制表 (不常用，按需添加)
};

// 使用一个不太可能与用户输入冲突的唯一占位符
// 用于临时保护 \\ ，使其不参与后续 \n, \t 等的替换
const BACKSLASH_PLACEHOLDER = '__GUGU_BACKSLASH_PLACEHOLDER_7Xw9Zq__';
// 创建占位符的全局正则表达式，提高复用效率
const PLACEHOLDER_REGEX = new RegExp(BACKSLASH_PLACEHOLDER, 'g');

/**
 * 解析用户输入的字符串，处理常见的转义字符。
 * 核心逻辑：
 * - 用户输入的 \n, \t, \r, \", \' 会被转换成对应的实际字符。
 * - 用户输入的 \\n, \\t, \\r, \\", \\' 会被转换成字面量的 "\n", "\t", 等字符串。
 * - 用户输入的 \\ 会被转换成字面量的 "\"。
 * - 未知转义（如 \z）保持原样。
 *
 * 示例:
 * parseEscapedCharacters("a\\nb\\n\\\\nc\\\\\\nd\\\\e\\t\\\"f")
 * 处理流程:
 * 1. 保护 \\ -> "a\\nb[PH]n[PH]\\nd[PH]e\\t\\\"f"
 * 2. 替换 \n, \t, \" -> "a\nb[PH]n[PH]\nd[PH]e\t\"f"  (这里的 \n \t \" 是实际字符)
 * 3. 还原 [PH] 为 \ -> "a\nb\n\\\nd\\e\t\"f"      (这里的 \n \t \" 是实际字符, \ 是字面量)
 * 结果:
`a
b\n\\
d\ e  "f`
 *
 * @param rawInput 用户输入的原始字符串
 * @param customMap 可选，自定义或覆盖默认的转义映射
 * @returns 处理后的字符串
 */
export function parseEscapedCharacters(
  rawInput: string,
  customMap?: Record<string, string>
): string {
  // 防御性编程
  if (typeof rawInput !== 'string') {
    return rawInput;
  }
  if (rawInput.length === 0) {
    return "";
  }

  const effectiveMap = { ...ESCAPE_MAP, ...customMap };

  // 步骤 1: 保护 "\\": 将所有的 \\ 替换为占位符
  // 这样可以确保后续替换 \n, \t 时，不会错误地处理 \\n, \\t 中的 \
  // 例如: "C:\\\\Users\\nTest\\t" -> "C:[PH]Users\\nTest\\t"
  let processedStr = rawInput.replace(/\\\\/g, BACKSLASH_PLACEHOLDER);

  // 步骤 2: 遍历映射表，将受支持的 \字符 替换为其实际字符
  // 例如: 将上一步的 "C:[PH]Users\\nTest\\t" 中的 \n 和 \t 替换
  // 结果: "C:[PH]Users\nTest\t" (这里的 \n 和 \t 是实际的换行符和制表符)
  for (const char in effectiveMap) {
    // 确保 key 不是原型链上的属性
    if (Object.prototype.hasOwnProperty.call(effectiveMap, char)) {
      // 构造正则表达式，例如 /\\n/g, /\\t/g, /\\"/g
      // 需要注意 char 本身是否为正则特殊字符，但对于 n,t,r," 来说没问题。
      // 如果 map key 包含正则元字符如 . * + ? 等，则 char 需要被 escapeRegExp 处理。
      const regex = new RegExp(`\\\\${char}`, 'g');
      processedStr = processedStr.replace(regex, effectiveMap[char]!);
    }
  }

  // 步骤 3: 将占位符还原为单个反斜杠 "\"
  // 例如: 将上一步的 "C:[PH]Users\nTest\t" 中的 [PH] 替换为 \
  // 结果: "C:\Users\nTest\t" (这里的 \n 和 \t 是实际字符，\ 是字面量)
  // 原始的 \\n -> [PH]n -> [PH]n -> \n (字面量)
  // 原始的 \n  -> \n    -> \n (实际) -> \n (实际)
  // 原始的 \\  -> [PH]  -> [PH]   -> \  (字面量)
  // JS 字符串中 '\\\\' 代表一个字面量的反斜杠 \
  processedStr = processedStr.replace(PLACEHOLDER_REGEX, '\\');

  return processedStr;
}

// --- 使用范例 ---
/*
const testString1 = "line1\\nline2\\nline3\\\\nline4\\\\\\\\line5\\tTAB\\rCR\\\\zUnknown";
console.log("--- Input 1 ---");
console.log(testString1);
console.log("--- Output 1 ---");
console.log(parseEscapedCharacters(testString1));
// 预期输出:
// line1
// line2\nline3\\nline4\\line5   TABCR\zUnknown

const testString2 = 'Quote: \\"Hello\\", Single: \\\'World\\\'';
 console.log("\\n--- Input 2 ---");
 console.log(testString2);
 console.log("--- Output 2 ---");
 console.log(parseEscapedCharacters(testString2));
 // 预期输出:
 // Quote: "Hello", Single: 'World'

 // 测试自定义映射
 const testString3 = "Color: \\cRed";
  console.log("\\n--- Input 3 Custom ---");
 console.log(testString3);
 console.log("--- Output 3 Custom ---");
 // 假设 \c 代表某种颜色代码起始符
 console.log(parseEscapedCharacters(testString3, {'c': '\x1b[31m'}));
 // 预期: \c 被替换为红色 ANSI color code

  console.log("\\n--- Input 4 Empty/Null ---");
  console.log(parseEscapedCharacters("")); // ""
  // @ts-ignore
  console.log(parseEscapedCharacters(null)); // null
   // @ts-ignore
  console.log(parseEscapedCharacters(123)); // 123
*/
