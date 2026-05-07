---
layout: home

hero:
  name: "Effect.ts Tutor"
  text: 给 TanStack Query 信徒的 Effect.ts 入门教程
  tagline: 你不用"学 FP"。你只需要把一件你早就在做的事，往前推一步。
  actions:
    - theme: brand
      text: 从序言开始
      link: /00-prelude
    - theme: alt
      text: 速查表
      link: /cheatsheet

features:
  - title: TQ 视角类比
    details: 每一章从 TanStack Query 的已知概念出发，展示 Effect 填补了它的哪一半空白。不是学新范式，是把你已经在做的事情类型化。
  - title: 签名先行
    details: 先看类型签名再看实现。读签名、写 operator chain 用 pipe；写 if/for/try 逻辑用 gen。知道什么时候选哪个，你就理解了 80% 的 Effect 代码。
  - title: 十一 + 一
    details: 11 章正文覆盖 A/E/R 三维、pipe/gen 组合、错误处理、调度重试、并发 Fiber、资源 Scope、依赖注入、Schema 边界、Stream、React 共存；加一份可直接喂给 AI 助手的速查表。
---

## 学习路径

```mermaid
graph TD
    A[00 序言<br/>你已经会了那一半] --> B[01 Effect&lt;A, E, R&gt;<br/>三维签名]
    B --> C[02 pipe 与 Effect.gen<br/>两副组合面孔]
    C --> D[03 错误维度 E<br/>typed error 与 Cause]
    D --> E[04 Schedule、retry 与 timeout<br/>时间的控制]
    E --> F[05 并发与 Fiber<br/>Effect.all / race / fork]
    F --> G[06 资源与 Scope<br/>acquireRelease]
    G --> H[07 Context.Tag 与 Layer<br/>R 维度的兑现]
    H --> I[08 Schema：边界处的硬墙<br/>decodeUnknown]
    I --> J[09 Stream<br/>超出 TQ 的领域]
    J --> K[10 与 TQ / React 共存<br/>实战拼装]
    K --> L[11 收尾<br/>告诫与进阶路径]
```

## 前置要求

- 熟悉 TanStack Query（`useQuery`、`queryFn`、`staleTime`、`refetch`）
- 熟悉 TypeScript 泛型基础（知道 `T extends X` 是什么意思）

## 索引

| 章节 | 核心签名 / 概念 |
|------|----------------|
| [00 序言](00-prelude) | TQ → Effect 思路连续性 |
| [01 三维签名](01-effect-aer) | `Effect<A, E, R>` |
| [02 组合](02-pipe-and-gen) | `pipe` / `Effect.gen + yield*` |
| [03 错误维度](03-error-channel) | `catchTag` / `Cause` |
| [04 调度重试](04-schedule-retry) | `Schedule` / `retry` / `timeout` |
| [05 并发 Fiber](05-fiber-concurrency) | `Effect.all` / `race` / `fork` |
| [06 资源 Scope](06-resource-scope) | `acquireRelease` / `Scope` |
| [07 依赖注入](07-context-layer) | `Context.Tag` / `Layer` |
| [08 Schema 边界](08-schema-boundary) | `Schema.Struct` / `decodeUnknown` |
| [09 Stream](09-stream) | `Stream<A, E, R>` |
| [10 React 共存](10-react-coexistence) | `runPromise` in `queryFn` / `@effect-rx` |
| [11 收尾](11-coda) | API 漂移告诫 / 进阶路径 |
| [速查表](cheatsheet) | 常用签名一览（可喂给 agent） |
