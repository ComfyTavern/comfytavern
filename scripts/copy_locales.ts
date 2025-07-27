import fs from 'fs/promises';
import path from 'path';

// Bun.js/Node.js 的 import.meta.url 提供了当前文件的URL
// 我们可以用它来定位项目根目录
const scriptUrl = new URL(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(scriptUrl));
const projectRoot = path.resolve(scriptDir, '..');

const sourceDir = path.join(projectRoot, 'scripts', 'merged_locales');
const destDir = path.join(projectRoot, 'apps', 'frontend-vueflow', 'src', 'locales');

// 为了在 Node.js 和 Bun 中都能工作，需要一个辅助函数
function fileURLToPath(url: URL): string {
  if (url.protocol !== 'file:') {
    throw new Error('URL must be a file URL');
  }
  return decodeURIComponent(url.pathname.replace(/^\/([A-Z]:)/, '$1'));
}

async function copyLocales() {
  console.log('正在复制语言环境文件...');
  console.log(`源目录: ${sourceDir}`);
  console.log(`目标目录: ${destDir}`);

  try {
    // 检查源目录是否存在
    await fs.access(sourceDir);
  } catch (error) {
    console.error(`错误：源目录 "${sourceDir}" 不存在。`);
    process.exit(1);
  }

  try {
    // 确保目标目录存在
    await fs.mkdir(destDir, { recursive: true });

    // 读取源目录中的所有文件
    const files = await fs.readdir(sourceDir);

    // 过滤出 .json 文件
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log('在源目录中没有找到 .json 文件。');
      return;
    }

    // 复制每个 .json 文件
    for (const file of jsonFiles) {
      const sourceFile = path.join(sourceDir, file);
      const destFile = path.join(destDir, file);
      await fs.copyFile(sourceFile, destFile);
      console.log(`已复制 ${sourceFile} 到 ${destFile}`);
    }

    console.log('\n语言环境文件已成功复制！');
  } catch (error) {
    console.error('复制文件时发生错误:', error);
    process.exit(1);
  }
}

copyLocales();