# 11 收尾：告诫、案例与进阶路径

> **钩子**：你把 11 章读完了。这章不是新概念，是三件实际落地时必须知道的事：API 漂移风险、真实案例证明、以及怎么让 AI 助手写出靠谱的 Effect 代码。

## 告诫一：API 变动，老文章不可信

Effect 的 API 变动频率远高于 TQ。以 2025-2026 年的情况举例：

- `@effect/schema` 包已并入主 `effect` 包，旧导入 `import { Schema } from "@effect/schema"` 仍可用但会提示迁移。
- `Context.Tag` 的写法从 `Context.Tag<A, B>()` 变成 `class X extends Context.Tag("X")<X, B>() {}` 形式，2023 年前的文章基本是旧 API。
- `pipe` 曾是独立导入，现在可以用方法链 `.pipe()` 替代。
- `Effect.gen` 的 `function*` 写法在某些版本里有细微行为差异。

**实际操作原则**：

1. **固定 major.minor 版本**：`"effect": "3.x.x"` 在 package.json 里明确写 minor 版本号，不用 `^`（会自动升到下一个 minor）。
2. **遇到报错先看官方 CHANGELOG**：[github.com/Effect-TS/effect/releases](https://github.com/Effect-TS/effect/releases)
3. **官方文档优先**：[effect.website/docs](https://effect.website/docs)，不要直接用 Stack Overflow 或两年前的 Medium 文章。
4. **不要让 AI 助手凭记忆写 Effect**：训练语料里 Effect 的旧 API 占多数，要给它当前版本的 snippet 参考。

## 告诫二：让 AI 写 Effect 代码的正确姿势

kickoff 里说了："直接让 AI 从零起手用 Effect 写大型项目，目前还不到时候。"

但有正确姿势：

**喂 cheatsheet 给 agent**：把 [cheatsheet.md](cheatsheet.md) 的内容作为 system prompt 的一部分，或者放进 CLAUDE.md / `.cursorrules`。这给了 agent 当前版本 API 的正确形状参考。

**让 AI 补全，不让 AI 架构**：告诉 AI "我要在这个 Effect.gen 里加一个 retry，retry 策略是指数退避 3 次"，而不是"帮我用 Effect 写一个完整的 HTTP service"。前者有明确的局部约束，后者容易生成混合了旧 API 的代码。

**人工 review 类型签名**：让 AI 生成后，自己检查 R 槽位是否正确、catchTag 的 tag 是否和错误类型的 `_tag` 对应。tsc 会告诉你类型不对，但 runtime 行为上的语义错误（比如把 retry 写成 repeat）tsc 发现不了。

## 真实案例：14.ai

14.ai 是一个 AI 客服创业公司，把整个 TypeScript stack 建在 Effect 上。他们选择 Effect 的原因——来自他们公开分享的内容——和这份教程的核心论点完全一致：

- LLM agent 系统的核心挑战是"不可靠 API + 非确定性模型输出 + fallback 链的复杂编排"
- Effect 的 `retry / timeout / catchTag / Stream` 精确描述了这些编排策略
- `Layer` 让测试时换掉 LLM provider 变成了编译期保证的事，而不是"别忘了 mock"的口头约定

他们的架构说明了一件事：Effect 在 agent 系统里的价值不是"让 AI 写出不会内存泄漏的代码"，而是"把你手写的编排策略类型化，让人类 review 时有锚点"。

## 进阶路径（按需探索）

你读完 11 章后，Effect 生态里还有这些：

| 主题 | 入口 |
|------|------|
| `@effect/platform` | HTTP server、FileSystem、WorkerRunner 的 Effect 封装；在 Node/Bun/Deno 上的统一 API |
| `@effect/cluster` | 分布式 actor 模型；分片、消息传递、故障恢复 |
| `@effect/sql` | SQL 查询的 Effect 封装；类型安全的 query builder |
| `@effect/printer` | Pretty-print 格式化 |
| Effect Testing | `TestClock`、`TestLive`——测试里控制时间和 Layer |
| `Effect.matchCause` | 更细粒度的 Cause 处理（failure / defect / interrupt 三路分发） |
| Deferred | Promise 的 Effect 等价物，主动 resolve/reject 一个 Effect |
| Ref | 可变状态的 Effect 封装（类似 `useRef` 但线程安全） |
| Queue / PubSub | 消息队列和发布订阅的 fiber 安全实现 |

**不建议立刻学**：先把前 10 章的概念在一个真实模块里实践一遍，再看 platform / cluster。

## 最后一句话

kickoff 第四回说的那个框架——"chunk 内压缩"作为扩展工作记忆的支路——这份教程就是按这条路设计的。`Effect<A, E, R>` 是一个 chunk，你现在能从这个 chunk 里读出"成功类型、错误类型、运行时依赖、是否 cold、如何组合"。这就是 11 章想让你拥有的那种密度。

剩下的是练——拿你项目里最痛的一个 API 调用链，用 Effect 重写，感受类型签名带来的约束感是不是你想要的那种 rigidity。

---

← [10-react-coexistence.md](10-react-coexistence.md) | [速查表 →](cheatsheet.md)
