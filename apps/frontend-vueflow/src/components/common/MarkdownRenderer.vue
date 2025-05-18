<!-- packages/components/src/markdown/MarkdownRenderer.vue -->
<template>
  <div v-html="renderedHtml" class="markdown-content"></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Marked, Renderer, type Tokens } from "marked"; // 导入 Marked 类和 Renderer 类
import { markedHighlight } from "marked-highlight"; // 导入 marked-highlight
import DOMPurify from "dompurify";
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css'; // 引入 highlight.js CSS 主题

interface Props {
  /** Markdown 文本内容 */
  markdownContent: string;
}

const props = defineProps<Props>();

/** 将 Markdown 渲染为安全的 HTML */
const renderedHtml = computed(() => {
  if (!props.markdownContent) return "";
  // 配置 marked 以添加 target="_blank" 到链接，并在新标签页打开
  const renderer = new Renderer(); // 使用导入的 Renderer 类
  // 使用 marked 导出的 Tokens.Link 类型确保类型正确
  renderer.link = (options: Tokens.Link) => {
    const { href, title, text } = options; // 从 options 中解构出需要的属性
    // 先对 href 和 title 进行初步净化，防止注入恶意脚本
    // title 可能为 null，需要正确处理
    const safeHref = DOMPurify.sanitize(href || "", { USE_PROFILES: { html: false } }); // 不允许 HTML 标签
    const safeTitle = title ? DOMPurify.sanitize(title, { USE_PROFILES: { html: false } }) : null;
    // 再次检查 href 是否是有效的 URL (简单的协议检查)
    const finalHref = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(safeHref) ? safeHref : "#";
    // 注意：新版 marked 的 text 可能包含内部的 token 结构，但对于简单链接，直接使用 text 通常可以
    // 如果需要更复杂的处理（例如处理链接内的强调等），需要递归渲染 options.tokens
    return `<a href="${finalHref}" target="_blank" ${safeTitle ? `title="${safeTitle}"` : ""
      } rel="noopener noreferrer">${text}</a>`;
  };

  // 创建 Marked 实例并配置
  const localMarked = new Marked(
    { // MarkedOptions
      renderer,
      breaks: true,
    },
    markedHighlight({ // MarkedExtension for highlight
      langPrefix: 'hljs language-',
      highlight(code: string, lang: string) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        try {
          return hljs.highlight(code, { language, ignoreIllegals: true }).value;
        } catch (e) {
          console.error("MarkdownRenderer: Error highlighting code block", e);
          // 在出错时，返回未高亮的原始代码，但进行HTML转义以防止XSS
          return hljs.highlight(code, { language: 'plaintext', ignoreIllegals: true }).value;
        }
      }
    })
  );

  const rawHtml = localMarked.parse(props.markdownContent || "") as string; // 添加 || '' 防止 content 为 undefined
  // 净化最终的 HTML，允许基本的 Markdown 格式标签，并允许 target 属性
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true }, // 使用默认的 HTML 配置，允许常见格式标签
    ADD_ATTR: ["target"], // 明确允许 target 属性 (用于 target="_blank")
    FORBID_TAGS: ["style", "script"], // 明确禁止 style 和 script 标签
    FORBID_ATTR: ["onerror", "onload"], // 明确禁止危险的事件处理器属性
  });
});
</script>

<style scoped>
/* 只保留 .markdown-content 容器本身的基础样式 */
.markdown-content {
  pointer-events: auto;
  /* 允许与 Markdown 内容交互，例如点击链接 */
  word-wrap: break-word;
  /* 允许长单词换行 */
  white-space: normal;

  /* 允许自动换行 */
  /* 移除所有针对内部 p, ul, li, code, pre 等元素的样式 */
  /* 为嵌套列表添加缩进 */
  & :deep(ul),
  & :deep(ol) {
    /* 重置可能影响嵌套列表的顶层列表默认边距 */
    /* 如果全局样式已处理，这可能不是必需的，但为了保险起见 */
    /* margin-block-start: 0.5em; */
    /* 保留一些垂直间距 */
    /* margin-block-end: 0.5em; */
    /* padding-inline-start: 1.5em; */
    /* 保留一级列表的缩进 */
  }

  & :deep(ul ul),
  & :deep(ol ol),
  & :deep(ul ol),
  & :deep(ol ul) {
    /* 重置默认内外边距 */
    margin-top: 0.2em;
    /* 稍微增加嵌套列表与其父项之间的间距 */
    margin-bottom: 0.2em;
    margin-left: 0;
    /* 重置 margin-left */
    padding-left: 0.8em;
    /* 使用 padding-left 控制缩进 */
  }

  /* 这些样式现在由全局 base.css 处理 */
}
</style>