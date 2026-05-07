import { defineConfig } from 'vitepress'

export default defineConfig({
    title: "Effect.ts Tutor",
    description: "给 TanStack Query 信徒的 Effect.ts 入门教程 — 三维签名、类型化错误、并发、资源安全、依赖注入、Schema 边界、Stream",
    ignoreDeadLinks: true,
    themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Cheatsheet', link: '/cheatsheet' }
    ],

    sidebar: [
      {
        text: '正文',
        items: [
          { text: '00 序言：你已经会了那一半', link: '/00-prelude' },
          { text: '01 Effect&lt;A, E, R&gt;：三维签名', link: '/01-effect-aer' },
          { text: '02 pipe 与 Effect.gen', link: '/02-pipe-and-gen' },
          { text: '03 错误维度 E', link: '/03-error-channel' },
          { text: '04 Schedule、retry 与 timeout', link: '/04-schedule-retry' },
          { text: '05 并发与 Fiber', link: '/05-fiber-concurrency' },
          { text: '06 资源与 Scope', link: '/06-resource-scope' },
          { text: '07 Context.Tag 与 Layer', link: '/07-context-layer' },
          { text: '08 Schema：边界处的硬墙', link: '/08-schema-boundary' },
          { text: '09 Stream', link: '/09-stream' },
          { text: '10 与 TQ / React 共存', link: '/10-react-coexistence' },
          { text: '11 收尾', link: '/11-coda' },
        ]
      },
      {
        text: '参考',
        items: [
          { text: 'Cheatsheet 速查表', link: '/cheatsheet' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Effect-TS/effect' }
    ],

    search: {
      provider: 'local'
    }
  }
})
