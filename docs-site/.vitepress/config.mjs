import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "ComfyTavern 文档",
  description: "一个面向创作者和最终用户的 AI 创作与应用平台。",
  
  // 基础路径
  base: '/',

  // 重写规则：将根路径映射到中文内容
  rewrites: {
    'zh/:rest*': ':rest*'
  },

  // 主题配置
  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ComfyTavern/comfytavern' }
    ],
    search: {
      provider: 'local'
    }
  },

  // 多语言配置
  locales: {
    // 中文配置（默认语言，映射到根路径）
    root: {
      label: '简体中文',
      lang: 'zh',
      title: "ComfyTavern 文档",
      description: "一个面向创作者和最终用户的 AI 创作与应用平台。",
      
      themeConfig: {
        nav: [
          { text: '首页', link: '/' },
          { text: '创作者指南', link: '/guide-for-creators/' },
          { text: '开发者文档', link: '/developer-docs/core-concepts/workflow-concepts' }
        ],
        sidebar: {
          '/developer-docs/': [
            {
              text: '核心概念',
              collapsed: false,
              items: [
                { text: '工作流概念', link: '/developer-docs/core-concepts/workflow-concepts' },
                { text: '节点与插槽类型系统', link: '/developer-docs/core-concepts/node-type-system' },
              ]
            },
            {
              text: '扩展开发',
              collapsed: false,
              items: [
                { text: '自定义节点开发', link: '/developer-docs/extension-dev/node-dev/custom-node-guide' },
                { text: '客户端脚本指南', link: '/developer-docs/extension-dev/node-dev/client-script-guide' },
                { text: '面板 SDK 开发', link: '/developer-docs/extension-dev/panel-dev/panel-sdk-guide' },
                { text: '国际化', link: '/developer-docs/extension-dev/i18n/customizing-ui-language' },
              ]
            },
            {
                text: '源码与架构解析',
                collapsed: false,
                items: [
                  { text: '前端内容与风格指南', link: '/developer-docs/architecture/frontend-style-guide' },
                  { text: '历史记录系统', link: '/developer-docs/architecture/history-system' },
                  { text: '文件与资产管理', link: '/developer-docs/architecture/file-asset-management' },
                ]
            }
          ]
        },
        selectLanguageText: '选择语言',
        selectLanguageName: '简体中文',
        lastUpdatedText: '最后更新时间',
        editLinkText: '在 GitHub 上编辑此页',
        outlineTitle: '本页目录'
      }
    },
    // 英文配置
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      title: "ComfyTavern Docs",
      description: "An AI creation and application platform for creators and end-users.",

      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Creator Guides', link: '/en/guide-for-creators/' },
          { text: 'Developer Docs', link: '/en/developer-docs/core-concepts/workflow-concepts' }
        ],
        sidebar: {
          '/en/developer-docs/': [
            {
              text: 'Core Concepts',
              collapsed: false,
              items: [
                { text: 'Workflow Concepts', link: '/en/developer-docs/core-concepts/workflow-concepts' },
                { text: 'Node and Slot Type System', link: '/en/developer-docs/core-concepts/node-type-system' },
              ]
            },
            {
              text: 'Extension Development',
              collapsed: false,
              items: [
                { text: 'Custom Node Development', link: '/en/developer-docs/extension-dev/node-dev/custom-node-guide' },
                { text: 'Client Script Guide', link: '/en/developer-docs/extension-dev/node-dev/client-script-guide' },
                { text: 'Panel SDK Development', link: '/en/developer-docs/extension-dev/panel-dev/panel-sdk-guide' },
                { text: 'Internationalization', link: '/en/developer-docs/extension-dev/i18n/customizing-ui-language' },
              ]
            },
            {
                text: 'Source Code & Architecture Analysis',
                collapsed: false,
                items: [
                  { text: 'Frontend Content & Style Guide', link: '/en/developer-docs/architecture/frontend-style-guide' },
                  { text: 'History System', link: '/en/developer-docs/architecture/history-system' },
                  { text: 'File & Asset Management', link: '/en/developer-docs/architecture/file-asset-management' },
                ]
            }
          ]
        },
        selectLanguageText: 'Languages',
        selectLanguageName: 'English',
        lastUpdatedText: 'Last Updated',
        editLinkText: 'Edit this page on GitHub',
        outlineTitle: 'On this page'
      }
    }
  }
})