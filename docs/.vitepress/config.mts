import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ClassIntra',
  description: 'ClassIntra 校园内网 WebOS 官方文档',
  lastUpdated: true,
  base: '/',
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#0947FA' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'ClassIntra 文档' }],
    ['meta', { name: 'og:description', content: '校园内网 WebOS 平台 · 类 iOS 设计 · 横屏平板优化 · 局域网即可运行' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'ClassIntra 文档',

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    nav: [
      { text: '首页', link: '/' },
      { text: '快速开始', link: '/quick-start/' },
      {
        text: '核心概念',
        items: [
          { text: '架构概览', link: '/concepts/' },
          { text: '应用架构', link: '/concepts/architecture' },
          { text: 'Manifest 清单', link: '/concepts/manifest' },
          { text: '主题系统', link: '/concepts/theme-system' },
          { text: 'WebSocket 通信', link: '/concepts/websocket' },
          { text: '认证与权限', link: '/concepts/auth' },
          { text: '应用管控', link: '/concepts/app-control' },
        ]
      },
      {
        text: '开发指南',
        items: [
          { text: '简介', link: '/development/' },
          { text: '第三方应用开发', link: '/development/third-party' },
          { text: '小组件开发', link: '/development/widgets' },
          { text: '插件开发', link: '/development/plugins' },
          { text: '主题开发', link: '/development/themes' },
          { text: 'SDK 参考', link: '/development/sdk' },
          { text: 'CLI 工具', link: '/development/cli' },
          { text: '调试技巧', link: '/development/debugging' },
        ]
      },
      {
        text: '部署运维',
        items: [
          { text: '简介', link: '/deployment/' },
          { text: '生产部署', link: '/deployment/production' },
          { text: '教育场景', link: '/deployment/education' },
          { text: '配置项', link: '/deployment/configuration' },
          { text: '监控运维', link: '/deployment/monitoring' },
        ]
      },
      {
        text: 'API 参考',
        items: [
          { text: '服务端 API', link: '/api/server' },
          { text: '前端 API', link: '/api/client' },
          { text: '类型定义', link: '/api/types' },
        ]
      },
      { text: 'GitHub', link: 'https://github.com/ClassIntra/ClassIntra' },
    ],

    sidebar: [
      {
        text: '快速开始',
        collapsed: false,
        items: [
          { text: '简介', link: '/quick-start/' },
          { text: '安装', link: '/quick-start/installation' },
          { text: '基本使用', link: '/quick-start/basic-usage' },
        ]
      },
      {
        text: '核心概念',
        collapsed: false,
        items: [
          { text: '架构概览', link: '/concepts/' },
          { text: '应用架构', link: '/concepts/architecture' },
          { text: 'Manifest 清单', link: '/concepts/manifest' },
          { text: '主题系统', link: '/concepts/theme-system' },
          { text: 'WebSocket 通信', link: '/concepts/websocket' },
          { text: '认证与权限', link: '/concepts/auth' },
          { text: '应用管控', link: '/concepts/app-control' },
        ]
      },
      {
        text: '开发指南',
        collapsed: false,
        items: [
          { text: '简介', link: '/development/' },
          { text: '第三方应用开发', link: '/development/third-party' },
          { text: '小组件开发', link: '/development/widgets' },
          { text: '插件开发', link: '/development/plugins' },
          { text: '主题开发', link: '/development/themes' },
          { text: 'SDK 参考', link: '/development/sdk' },
          { text: 'CLI 工具', link: '/development/cli' },
          { text: '调试技巧', link: '/development/debugging' },
        ]
      },
      {
        text: '部署运维',
        collapsed: false,
        items: [
          { text: '简介', link: '/deployment/' },
          { text: '生产部署', link: '/deployment/production' },
          { text: '教育场景', link: '/deployment/education' },
          { text: '配置项', link: '/deployment/configuration' },
          { text: '监控运维', link: '/deployment/monitoring' },
        ]
      },
      {
        text: 'API 参考',
        collapsed: false,
        items: [
          { text: '简介', link: '/api/' },
          { text: '服务端 API', link: '/api/server' },
          { text: '前端 API', link: '/api/client' },
          { text: '类型定义', link: '/api/types' },
        ]
      },
      {
        text: 'UI & 主题',
        collapsed: false,
        items: [
          { text: '简介', link: '/ui/' },
          { text: '组件库', link: '/ui/components' },
          { text: '主题定制', link: '/ui/theme' },
          { text: '图标系统', link: '/ui/icons' },
        ]
      },
    ],

    editLink: {
      pattern: 'https://github.com/ClassIntra/classintra.github.io/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ClassIntra/ClassIntra' }
    ],

    footer: {
      message: '基于 <a href="https://github.com/ClassIntra/ClassIntra/blob/main/LICENSE">MIT 协议</a> 开源',
      copyright: 'Copyright © 2024-present <a href="https://github.com/ClassIntra">ClassIntra</a>'
    },

    outline: {
      level: [2, 3],
      label: '页面导航'
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
  }
})
