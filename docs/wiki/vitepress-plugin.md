# VitePress 插件机制

## 概述

VitePress 没有独立的"插件系统"（不像 Vite 的 plugin API）。扩展 VitePress 的方式是通过 `defineConfig` 配置中的钩子：

- `markdown.config` — 扩展 markdown-it 渲染器
- `vite` — 注入 Vite 插件
- `transformPageData` — 转换页面数据
- `buildEnd` — 构建完成钩子

## markdown.config 钩子

这是最常用的扩展点。VitePress 底层使用 markdown-it 渲染 Markdown，`markdown.config` 接收 markdown-it 实例：

```ts
export default defineConfig({
  markdown: {
    config: (md) => {
      // md 是 markdown-it 实例
      // 可以 md.use(plugin) 注册插件
      // 可以直接修改 md.renderer.rules 覆盖渲染规则
    }
  }
})
```

## 自定义 Code Fence 渲染

要拦截特定语言的代码块（如 mermaid），需要覆盖 markdown-it 的 `fence` 渲染规则：

```ts
const defaultFence = md.renderer.rules.fence!

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const lang = token.info.trim()

  if (lang === 'mermaid') {
    // 自定义渲染逻辑
    return `<div class="mermaid">...</div>`
  }

  // 其他语言用默认渲染
  return defaultFence(tokens, idx, options, env, self)
}
```

## 关键参考

- VitePress `markdown` 配置：https://vitepress.dev/reference/site-config#markdown
- markdown-it 架构文档：https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md
- beautiful-mermaid：https://github.com/lukilabs/beautiful-mermaid （同步 SVG 渲染）
