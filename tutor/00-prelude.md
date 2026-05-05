# 00 序言：你已经会了那一半

> **钩子**：你不需要"学 FP"。你需要把一件你早就在做的事，往前推一步。

## TQ 视角类比

TanStack Query 解决的问题，用一句话说是：

> 不要自己 fire 请求，声明"我要这个数据"，让 runtime 去执行、缓存、订阅、重试。

这是函数式编程里最古老的原则——**分离描述与执行**。你已经信仰了这件事。

`useQuery({ queryKey, queryFn })` 是一个**描述**，不是一个执行。描述是稳定的；执行是 QueryClient 的事。useEffect 之所以会爆炸，是因为描述和执行强行耦合在一个闭包里——任何一个执行条件变化（依赖项），整个描述都要重跑。

记住这句话：**描述与执行分离**。下面所有内容都在它身上长出来。

## 那一半 TQ 没解的

TQ 只把这条原则用在了**读请求**上：

| 场景 | TQ 的处理 |
|------|----------|
| GET 数据 | ✅ 完美 |
| 错误类型 | ❌ `error: unknown` |
| 复杂 mutation 编排 | ❌ 你自己写逻辑 |
| 请求间依赖链 | ❌ `enabled` 凑合 |
| 超时 + 按类型 retry | ❌ 自己加 |
| 并发控制（最多 N 个） | ❌ 外接 limiter |
| 取消传播到下游 | ❌ AbortSignal 止步 |
| SSE / WebSocket / 流 | ❌ 超出范围 |
| 跨组件 service 注入 | ❌ 靠 Context / 全局单例凑 |

Effect 的位置就在这里——把"先描述再执行"这条思想，推广到**所有**副作用。

## 签名：先读这一行

```
Effect<A, E, R>
      ↑  ↑  ↑
      │  │  └── 运行时依赖（需要什么 service 才能跑）
      │  └───── 失败值类型（typed，不是 unknown）
      └──────── 成功值类型（对应 TQ 的 data）
```

对比 TQ：

| TQ | Effect |
|----|--------|
| `queryFn: () => Promise<User>` | `Effect<User, ApiError, HttpService>` |
| `error: unknown` | `E` 是精确类型 |
| 依赖靠 React Context 凑 | `R` 进入类型签名，编译期强制 |
| `retry/timeout` 是配置项 | 是可组合的算子（后面详讲） |
| 只管读请求 | 管所有副作用 |
| 取消止于 AbortSignal | fiber 级联取消 |
| 没有流抽象 | `Stream<A, E, R>` 一等公民 |

## 最小可跑感受（纯阅读版）

```typescript
import { Effect } from "effect"

// 这是一个描述。它什么都不做，直到你 run 它。
const greet = Effect.sync(() => "Hello, Effect!")

// 加 retry、加 timeout——都只是在描述上叠描述
const safe = greet.pipe(
  Effect.retry({ times: 3 }),
  Effect.timeout("1 second")
)

// 只有这里才真正执行
Effect.runPromise(safe).then(console.log)
```

`Effect.sync` 包裹同步计算。还没跑就是还没跑——这是 "cold" 的含义。下一章展开。

## 自检清单

- [ ] 能否不看任何资料，用一句话解释 TQ 的核心原则？
- [ ] `Effect<A, E, R>` 的三个字母分别对应 TQ 的哪个概念？（A=data, E=error typed, R=new）
- [ ] 为什么 `Effect.sync(() => x)` 创建时不会执行 `() => x`？
- [ ] TQ 解决了哪类副作用？Effect 推广到了哪里？

**下一章**：`Effect<A, E, R>` 的完整签名，以及 cold 为什么是组合性的前提。→ [01-effect-aer.md](01-effect-aer.md)
