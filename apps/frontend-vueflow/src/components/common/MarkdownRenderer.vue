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
import 'highlight.js/styles/atom-one-dark.css';

interface Props {
  /** Markdown 文本内容 */
  markdownContent: string;
}

const props = defineProps<Props>();

// 将 Marked 实例的创建和配置移出 computed，只执行一次
const renderer = new Renderer();
renderer.link = (options: Tokens.Link) => {
  const { href, title, text } = options;
  const safeHref = DOMPurify.sanitize(href || "", { USE_PROFILES: { html: false } });
  const safeTitle = title ? DOMPurify.sanitize(title, { USE_PROFILES: { html: false } }) : null;
  const finalHref = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(safeHref) ? safeHref : "#";
  return `<a href="${finalHref}" target="_blank" ${safeTitle ? `title="${safeTitle}"` : ""
    } rel="noopener noreferrer">${text}</a>`;
};

const highlightExtension = markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code: string, lang: string) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch (e) {
      console.error("MarkdownRenderer: Error highlighting code block", e);
      return hljs.highlight(code, { language: 'plaintext', ignoreIllegals: true }).value;
    }
  }
});

const localMarked = new Marked(
  {
    renderer,
    breaks: true,
  },
  highlightExtension
);

const purifyConfig = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["style", "script"],
  FORBID_ATTR: ["onerror", "onload"],
};

/** 将 Markdown 渲染为安全的 HTML */
const renderedHtml = computed(() => {
  if (!props.markdownContent) return "";
  const rawHtml = localMarked.parse(props.markdownContent) as string;
  return DOMPurify.sanitize(rawHtml, purifyConfig);
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

/* 代码块样式 */
/* <pre> 元素负责代码块的整体框架和背景 */
:deep(.markdown-content pre) {
  box-shadow: 0 1px 3px hsla(var(--ct-neutral-hsl), 0.08), 0 1px 2px hsla(var(--ct-neutral-hsl), 0.04);
  /* 更柔和的阴影, 这个可以保留或移到base.css */
  /* 其他在 base.css 中未定义的特定样式可以保留在这里 */
}

/* 内部 <code> 元素处理高亮，背景透明 */
:deep(pre code.hljs) {
  display: block;
  /* 确保 code 填满 pre */
  background-color: transparent;
  padding: 0;
  /* pre 元素已处理内边距 */
  /* 文本颜色由 highlight.js 的主题 (atom-one-dark.css) 控制 */
}
</style>