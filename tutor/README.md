# Effect.ts 个人 Tutor

> 专为 TanStack Query 信徒、没有 Haskell/fp-ts 背景的 TS 开发者定制。  
> 所有讲解以中文为主，技术名词和代码保留英文原文。

## 前置要求

- 熟悉 TanStack Query（`useQuery`、`queryFn`、`staleTime`、`refetch`）
- 熟悉 TypeScript 泛型基础（知道 `T extends X` 是什么意思）
- 读过（或可以随时跳回）kickoff 文档：  
  [`docs/kickoff/[claude]Effect.ts 与 AI 编程的适配性.md`](../docs/kickoff/%5Bclaude%5DEffect.ts%20与%20AI%20编程的适配性.md)

## 学习路径

```
00-prelude      ← 地基：你已经信仰的那件事
    │
    ▼
01-effect-aer   ← 三维签名 Effect<A, E, R>
    │
    ▼
02-pipe-and-gen ← 两副组合面孔：pipe 与 Effect.gen
    │
    ▼
03-error-channel← E 维度：类型化错误与 Cause
    │
    ▼
04-schedule-retry ← 调度、重试、超时
    │
    ▼
05-fiber-concurrency ← 并发原语与取消语义
    │
    ▼
06-resource-scope ← 资源生命周期
    │
    ▼
07-context-layer ← R 维度的兑现：依赖注入
    │
    ▼
08-schema-boundary ← 边界处的硬墙
    │
    ▼
09-stream        ← 超出 TQ 的领域
    │
    ▼
10-react-coexistence ← 和 TQ / React 实战拼装
    │
    ▼
11-coda          ← 收尾、告诫、进阶路径
```

## 每章结构（统一骨架）

每章 .md 文件都遵循五段：

1. **一句话钩子** — 你为什么*现在*要读这章
2. **TQ 视角类比** — 本章概念在 TQ 里的近亲是什么、缺了什么
3. **签名拆解** — 先看类型签名，再看实现
4. **代码示例 + 踩坑示范** — 含常见错误的对比
5. **自检清单** — 3-5 条"你能不看示例自己写出 X 吗"，以及下一章预告

## 索引

| 章节 | 核心签名 / 概念 |
|------|----------------|
| [00 序言](00-prelude.md) | TQ → Effect 思路连续性 |
| [01 三维签名](01-effect-aer.md) | `Effect<A, E, R>` |
| [02 组合](02-pipe-and-gen.md) | `pipe` / `Effect.gen + yield*` |
| [03 错误维度](03-error-channel.md) | `catchTag` / `Cause` |
| [04 调度重试](04-schedule-retry.md) | `Schedule` / `retry` / `timeout` |
| [05 并发 Fiber](05-fiber-concurrency.md) | `Effect.all` / `race` / `fork` |
| [06 资源 Scope](06-resource-scope.md) | `acquireRelease` / `Scope` |
| [07 依赖注入](07-context-layer.md) | `Context.Tag` / `Layer` |
| [08 Schema 边界](08-schema-boundary.md) | `Schema.Struct` / `decodeUnknown` |
| [09 Stream](09-stream.md) | `Stream<A, E, R>` |
| [10 React 共存](10-react-coexistence.md) | `runPromise` in `queryFn` / `@effect-rx` |
| [11 收尾](11-coda.md) | API 漂移告诫 / 进阶路径 |
| [速查表](cheatsheet.md) | 常用签名一览（可喂给 agent） |
