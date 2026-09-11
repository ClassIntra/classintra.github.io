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
    logo: '/logo-d.png',
    siteTitle: '文档',

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
      {
        text: '快速开始',
        items: [
          { text: '简介', link: '/quick-start/' },
          { text: '安装', link: '/quick-start/installation' },
          { text: '基本使用', link: '/quick-start/basic-usage' },
          { text: '账号与 API 快速开始', link: '/quick-start/account-and-api' }
        ]
      },
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
          { text: '市场应用生命周期', link: '/development/market-apps' },
          { text: '小组件开发', link: '/development/widgets' },
          { text: '插件开发', link: '/development/plugins' },
          { text: '主题开发', link: '/development/themes' },
          { text: 'SDK 参考', link: '/development/sdk' },
          { text: 'CLI 工具', link: '/development/cli' },
          { text: '调试技巧', link: '/development/debugging' },
          { text: '联机五子棋开发', link: '/development/gomoku-online' },
          { text: '外部系统集成', link: '/development/integration' },
          { text: 'Chrome 80 兼容', link: '/development/chrome-80-compat' },
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
          { text: '数据库迁移', link: '/deployment/database-migration' },
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
          { text: '账号与 API 快速开始', link: '/quick-start/account-and-api' },
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
          { text: '市场应用生命周期', link: '/development/market-apps' },
          { text: '小组件开发', link: '/development/widgets' },
          { text: '插件开发', link: '/development/plugins' },
          { text: '主题开发', link: '/development/themes' },
          { text: 'SDK 参考', link: '/development/sdk' },
          { text: 'CLI 工具', link: '/development/cli' },
          { text: '调试技巧', link: '/development/debugging' },
          { text: '联机五子棋开发', link: '/development/gomoku-online' },
          { text: '外部系统集成', link: '/development/integration' },
          { text: 'Chrome 80 兼容', link: '/development/chrome-80-compat' },
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
          { text: '数据库迁移', link: '/deployment/database-migration' },
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
      {
        icon: {
          svg: '<svg height="32" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><path d="m0 0h32v32h-32z"/><path d="m16 0c8.836556 0 16 7.163444 16 16s-7.163444 16-16 16-16-7.163444-16-16 7.163444-16 16-16zm0 8c-3.7399769.0001875-5.3104861 3.0644648-5.2111485 6.7175538-.5901401 1.4156544-.97168742 2.2735907-1.30533812 3.3055894-.70791437 2.1893722-.47854375 3.0954335-.30393072 3.115746.37475143.0435311 1.45865284-1.6481541 1.45865284-1.6481541 0 .9795924.5247821 2.2579032 1.6602545 3.1809958-.5483889.162531-1.7828087.5989055-1.488698 1.0754674.23789.3857182 4.0811325.2462809 5.1906568.126156 1.1095244.1201249 4.9527669.2595622 5.1906569-.126156.2939481-.4766869-.9417073-.9134055-1.4893484-1.0756549 1.1353099-.9230925 1.6599944-2.2012784 1.6599944-3.1808083 0 0 1.0839014 1.6916852 1.4586854 1.6481541.174613-.0203438.4039186-.9263738-.3038982-3.115746-.3327078-1.0289987-.7162061-1.8923413-1.3053381-3.3055582.0940374-3.7134327-1.5128902-6.7173975-5.2112008-6.717585z" fill="#202327"/></g></svg>'
        },
        link: 'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=y_6ndZUGpNu6dTuvpI4U3NQDs5FtIzIx&authKey=Tbq7hC6Ppe2r2WPKpvqLw1xnzjET5sfWBE45XjSvKOSJagX2WkkTx1Pat2EbqshZ&noverify=0&group_code=1074276021',
        ariaLabel: '加入 ClassIntra 2026 QQ 群'
      },
      { icon: 'github', link: 'https://github.com/ClassIntra/ClassIntra' }
    ],

    footer: {
      message: '基于 <a href="https://github.com/ClassIntra/ClassIntra/blob/main/LICENSE">MIT 协议</a> 开源 · <a href="http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&amp;k=y_6ndZUGpNu6dTuvpI4U3NQDs5FtIzIx&amp;authKey=Tbq7hC6Ppe2r2WPKpvqLw1xnzjET5sfWBE45XjSvKOSJagX2WkkTx1Pat2EbqshZ&amp;noverify=0&amp;group_code=1074276021" target="_blank" rel="noreferrer">加入 QQ 群【ClassIntra】</a>',
      copyright: 'Copyright © 2026 <a href="https://github.com/ClassIntra">ClassIntra</a>'
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
