# 09 Stream：超出 TQ 的领域

> **钩子**：`Effect<A, E, R>` 是"一次计算，产出一个 A"。`Stream<A, E, R>` 是"一次计算，随时间产出 0~N 个 A"。SSE、WebSocket、分页遍历、轮询，这些都是 Stream 的天然题。

## TQ 视角类比

TQ 不处理流式数据——它假设 `queryFn` 会返回一个 Promise，解析出来就结束了。如果你要 SSE 或 WebSocket，你要在 `queryFn` 里自己写 `new EventSource()`，把流式数据手动推进 React state，和 TQ 的生命周期不对齐。

Stream 是 Effect 里处理这类场景的一等公民：一个描述"多值生产者"的 cold 值。

## 签名

```
Stream<A, E, R>
       ↑  ↑  ↑
       │  │  └── 依赖（和 Effect 的 R 同义）
       │  └───── 失败（流可能在中间失败）
       └──────── 每个元素的类型
```

类比：Effect 是 Promise；Stream 是 AsyncIterable（但有错误类型和依赖追踪）。

## 创建 Stream

```typescript
import { Stream, Effect } from "effect"

// 从数组（有限流）
const numbers = Stream.make(1, 2, 3, 4, 5)
// Stream<number, never, never>

// 从 Effect（单值流）
const once = Stream.fromEffect(fetchUser("u-1"))
// Stream<User, ApiError, HttpClient>

// 从 AsyncIterable
const paginated = Stream.fromAsyncIterable(
  paginatedFetch("/api/users"),
  (e) => new NetworkError(500, "/api/users")
)

// tick：定时发出 void
const ticker = Stream.tick("1 second")
// 每秒发出一个 void，持续下去

// 结合 tick + flatMap 做轮询
const polling = Stream.tick("5 seconds").pipe(
  Stream.mapEffect(() => fetchStatus())
)
```

## Stream Operators

Stream 的 operators 和 Effect 的 operators 命名几乎对称：

```typescript
import { Stream } from "effect"

const processed = numbers.pipe(
  Stream.map(n => n * 2),                         // 变换每个元素
  Stream.filter(n => n > 4),                       // 过滤
  Stream.take(3),                                   // 只取前 3 个
  Stream.mapEffect((n) => saveToDb(n)),             // 每个元素执行 Effect
  Stream.tap((n) => Effect.log(`saved ${n}`)),      // 副作用，不改变元素
  Stream.catchAll((e) => Stream.empty)              // 流失败时换成空流
)
```

**常用 operator 速览：**

| Operator | 意思 |
|----------|------|
| `Stream.map(f)` | 变换每个元素 |
| `Stream.filter(pred)` | 过滤元素 |
| `Stream.flatMap(f)` | 每个元素展开成新 Stream（concat / interleave） |
| `Stream.mapEffect(f)` | 每个元素执行 Effect，顺序收集结果 |
| `Stream.take(n)` | 取前 n 个元素 |
| `Stream.takeUntil(pred)` | 直到满足条件为止 |
| `Stream.throttle` | 限速 |
| `Stream.buffer(n)` | 缓冲 n 个元素（处理背压） |
| `Stream.groupBy` | 按 key 分组成子 Stream |
| `Stream.zipLatest` | 合并两个流，取最新值组合 |

## 消费 Stream（Run）

```typescript
import { Stream, Effect } from "effect"

// 收集所有元素成数组
const all = yield* Stream.runCollect(numbers)
// Effect<Chunk<number>, never, never>

// 对每个元素执行副作用
yield* Stream.runForEach(numbers, (n) => Effect.log(`n = ${n}`))

// fold（归约）
const sum = yield* Stream.runFold(numbers, 0, (acc, n) => acc + n)

// 只消费第一个
const first = yield* Stream.runHead(numbers)
// Effect<Option<number>, never, never>
```

## SSE 示例

```typescript
import { Stream, Effect } from "effect"

// 简化的 SSE stream
const sseStream = (url: string): Stream.Stream<string, NetworkError> =>
  Stream.async<string, NetworkError>((emit) => {
    const source = new EventSource(url)
    
    source.onmessage = (e) => emit.single(e.data)
    source.onerror = () => emit.fail(new NetworkError(0, url))
    
    // cleanup 当 stream 被取消时调用
    return Effect.sync(() => source.close())
  })

// 使用
const liveFeed = sseStream("/api/events").pipe(
  Stream.mapEffect((raw) => Schema.decodeUnknown(EventSchema)(JSON.parse(raw))),
  Stream.filter((event) => event.type === "order"),
  Stream.tap((event) => Effect.log(`order event: ${event.id}`))
)
```

## 背压：Stream 不会淹没消费者

```typescript
// mapEffect 默认是顺序的（上一个处理完再处理下一个）
stream.pipe(Stream.mapEffect(slowProcessing))

// 并发处理，但限速
stream.pipe(Stream.mapEffect(slowProcessing, { concurrency: 3 }))
// 最多同时 3 个 Effect 在跑
```

## 故意踩坑：把 Stream 当 Effect 用

```typescript
// ❌ Stream 不能直接 yield*（它不是 Effect）
const result = yield* numbersStream  // 类型报错

// ✅ 先消费成 Effect
const result = yield* Stream.runCollect(numbersStream)

// ❌ 把 Array 误写成 Stream（make 的参数不是数组）
const s = Stream.make([1, 2, 3])  // Stream<number[], never, never>（一个元素，是数组）

// ✅ 展开数组
const s = Stream.make(1, 2, 3)                  // 展开参数
const s = Stream.fromIterable([1, 2, 3])         // 或者 fromIterable
```

## 自检清单

- [ ] `Effect<A, E, R>` 和 `Stream<A, E, R>` 的语义区别是什么？
- [ ] 如何用 `Stream.tick` + `Stream.mapEffect` 实现每 5 秒轮询一次？
- [ ] `Stream.runCollect` 和 `Stream.runForEach` 的区别？
- [ ] Stream 里的背压是什么？`mapEffect` 的 concurrency 参数控制的是什么？

**下一章**：完整的 Effect 知识都学完了。现在回到你的 React 项目——怎么把 Effect 和 TQ 拼在一起，哪些用 TQ，哪些用 Effect。→ [10-react-coexistence.md](10-react-coexistence.md)
