import { defineConfig } from "vitepress";

export default defineConfig({
  title: "ComfyTavern 文档",
  description: "一个面向创作者和最终用户的 AI 创作与应用平台。",
  base: "/",
  cleanUrls: true,
  lastUpdated: true,

  locales: {
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      themeConfig: {
        nav: [
          { text: "首页", link: "/zh/" },
          { text: "创作者指南", link: "/zh/guide-for-creators/" },
          { text: "开发者文档", link: "/zh/developer-docs/" },
        ],
        sidebar: {
          "/zh/developer-docs/": [
            {
              text: "核心概念",
              collapsed: false,
              items: [
                { text: "概述", link: "/zh/developer-docs/core-concepts/" },
                {
                  text: "工作流概念",
                  link: "/zh/developer-docs/core-concepts/workflow-concepts",
                },
                {
                  text: "节点与插槽类型系统",
                  link: "/zh/developer-docs/core-concepts/node-type-system",
                },
              ],
            },
            {
              text: "扩展开发",
              collapsed: false,
              items: [
                { text: "概述", link: "/zh/developer-docs/extension-dev/" },
                {
                  text: "自定义节点开发",
                  link: "/zh/developer-docs/extension-dev/node-dev/custom-node-guide",
                },
                {
                  text: "客户端脚本指南",
                  link: "/zh/developer-docs/extension-dev/node-dev/client-script-guide",
                },
                {
                  text: "面板 SDK 开发",
                  link: "/zh/developer-docs/extension-dev/panel-dev/panel-sdk-guide",
                },
                {
                  text: "国际化",
                  link: "/zh/developer-docs/extension-dev/i18n/customizing-ui-language",
                },
              ],
            },
            {
              text: "源码与架构解析",
              collapsed: false,
              items: [
                { text: "概述", link: "/zh/developer-docs/architecture/" },
                {
                  text: "前端内容与风格指南",
                  link: "/zh/developer-docs/architecture/frontend-style-guide",
                },
                {
                  text: "历史记录系统",
                  link: "/zh/developer-docs/architecture/history-system",
                },
                {
                  text: "文件与资产管理",
                  link: "/zh/developer-docs/architecture/file-asset-management",
                },
              ],
            },
          ],
        },
        lastUpdatedText: "最后更新",
        docFooter: {
          prev: "上一页",
          next: "下一页",
        },
        outlineTitle: "本页目录",
      },
    },
    en: {
      label: "English",
      lang: "en-US",
      link: "/en/",
      themeConfig: {
        nav: [
          { text: "Home", link: "/en/" },
          { text: "Creator Guides", link: "/en/guide-for-creators/" },
          { text: "Developer Docs", link: "/en/developer-docs/" },
        ],
        sidebar: {
          "/en/developer-docs/": [
            {
              text: "Core Concepts",
              collapsed: false,
              items: [
                { text: "Overview", link: "/en/developer-docs/core-concepts/" },
                {
                  text: "Workflow Concepts",
                  link: "/en/developer-docs/core-concepts/workflow-concepts",
                },
                {
                  text: "Node and Slot Type System",
                  link: "/en/developer-docs/core-concepts/node-type-system",
                },
              ],
            },
            {
              text: "Extension Development",
              collapsed: false,
              items: [
                { text: "Overview", link: "/en/developer-docs/extension-dev/" },
                {
                  text: "Custom Node Development",
                  link: "/en/developer-docs/extension-dev/node-dev/custom-node-guide",
                },
                {
                  text: "Client Script Guide",
                  link: "/en/developer-docs/extension-dev/node-dev/client-script-guide",
                },
                {
                  text: "Panel SDK Development",
                  link: "/en/developer-docs/extension-dev/panel-dev/panel-sdk-guide",
                },
                {
                  text: "Internationalization",
                  link: "/en/developer-docs/extension-dev/i18n/customizing-ui-language",
                },
              ],
            },
            {
              text: "Source Code & Architecture Analysis",
              collapsed: false,
              items: [
                { text: "Overview", link: "/en/developer-docs/architecture/" },
                {
                  text: "Frontend Content & Style Guide",
                  link: "/en/developer-docs/architecture/frontend-style-guide",
                },
                { text: "History System", link: "/en/developer-docs/architecture/history-system" },
                {
                  text: "File & Asset Management",
                  link: "/en/developer-docs/architecture/file-asset-management",
                },
              ],
            },
          ],
        },
        lastUpdatedText: "Last Updated",
        docFooter: {
          prev: "Previous page",
          next: "Next page",
        },
        outlineTitle: "On this page",
      },
    },
  },

  themeConfig: {
    socialLinks: [{ icon: "github", link: "https://github.com/ComfyTavern/comfytavern" }],
    search: {
      provider: "local",
    },
  },
});
