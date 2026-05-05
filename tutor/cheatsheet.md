# Effect.ts Cheatsheet

> 可以直接把这份文件内容粘贴给 AI 助手作为 context，帮助它写出当前版本正确的 Effect 代码。

---

## 导入

```typescript
import { Effect, pipe, Schedule, Stream, Layer, Context, Schema, Fiber, Scope, Duration, Option, Either, Cause } from "effect"
```

---

## 核心类型

```typescript
// 一个还没执行的副作用描述
Effect<A, E, R>
//     ↑  ↑  ↑
//     │  │  └── 运行时依赖（必须 provide 才能 run）
//     │  └───── 失败类型（typed，不是 unknown）
//     └──────── 成功类型

// 多值流
Stream<A, E, R>  // 类似 Effect 但产出 0~N 个 A

// R 为 never 时可以直接 run
Effect<A, E, never>  // 可 runPromise
```

---

## 创建 Effect

```typescript
Effect.succeed(42)                     // Effect<number, never, never>
Effect.fail(new MyError())             // Effect<never, MyError, never>
Effect.sync(() => Date.now())          // Effect<number, never, never>（不会 throw）
Effect.try({ try: () => ..., catch: (e) => new MyError() })
Effect.tryPromise({ try: () => fetch(...), catch: (e) => new NetworkError() })
Effect.promise(() => fetch(...))       // 不处理 reject（变成 defect）
Effect.void                            // Effect<void, never, never>
Effect.sleep("1 second")
Effect.sleep(Duration.millis(500))
Effect.log("message")
Effect.logError("error", e)
```

---

## 组合：pipe operators

```typescript
effect.pipe(
  Effect.map(a => b),               // 变换成功值
  Effect.flatMap(a => Effect<B>),   // 顺序执行另一个 Effect
  Effect.andThen(Effect<B>),        // flatMap 的简写（忽略前一个值时）
  Effect.tap(a => Effect<void>),    // 副作用，不改变值
  Effect.mapError(e => e2),         // 变换错误类型
  Effect.orElse(() => fallback),    // 失败时换备选
  Effect.ignore,                     // 忽略成功和失败，返回 Effect<void>
)
```

---

## Effect.gen（推荐写复杂逻辑）

```typescript
const program = Effect.gen(function* () {
  const a = yield* effectA          // 成功值解包，失败时短路
  const b = yield* effectB(a)
  if (b.needsMore) {
    yield* effectC()
  }
  return { a, b }
})
```

---

## 错误处理

```typescript
// Tagged Error（推荐约定）
class MyError {
  readonly _tag = "MyError"
  constructor(readonly message: string) {}
}

// 按 tag 分发
effect.pipe(
  Effect.catchTag("MyError", (e) => recovery),
  Effect.catchTag("OtherError", (e) => Effect.succeed(default)),
)

// 处理所有错误
effect.pipe(Effect.catchAll((e) => recovery))

// 变换错误
effect.pipe(Effect.mapError(e => new WrappedError(e)))

// failure vs defect（大多数时候不需要直接用 Cause）
Effect.catchAllCause(cause => {
  if (Cause.isFailure(cause)) { ... }
  if (Cause.isDie(cause)) { ... }   // defect（unexpected throw）
})
```

---

## 重试与超时

```typescript
import { Schedule } from "effect"

// Schedule 构造器
Schedule.recurs(3)                     // 重试 3 次
Schedule.spaced("500 millis")          // 固定间隔
Schedule.exponential("100 millis")     // 指数退避
Schedule.jittered                      // 加随机抖动（pipe 用）
Schedule.intersect(s1, s2)             // 两个策略都满足

// retry/timeout
effect.pipe(
  Effect.retry(Schedule.exponential("100 millis").pipe(
    Schedule.jittered,
    Schedule.intersect(Schedule.recurs(4))
  )),
  Effect.timeoutFail({ duration: "5 seconds", onTimeout: () => new TimeoutError() })
)

// repeat（成功后重复）
effect.pipe(Effect.repeat(Schedule.spaced("5 seconds")))
```

---

## 并发

```typescript
// 并行执行（返回数组或对象）
Effect.all([e1, e2, e3], { concurrency: "unbounded" })
Effect.all({ user: fetchUser, posts: fetchPosts })

// 竞速（谁先完成用谁，输的 fiber 自动取消）
Effect.race(primary, fallback)

// 批量处理
Effect.forEach(items, (item) => process(item), { concurrency: 3 })

// 手动 fork
const fiber = yield* Effect.fork(longTask)
const result = yield* Fiber.join(fiber)
yield* Fiber.interrupt(fiber)
```

---

## 资源管理

```typescript
// 保证 release 一定执行（不管 use 成功还是失败）
Effect.acquireUseRelease(
  acquire,                          // Effect<Resource, E, R>
  (resource) => use(resource),      // Resource -> Effect<A, E, R>
  (resource) => release(resource)   // Resource -> Effect<void, never, never>
)

// Scope 版（多个资源，统一 release）
const program = Effect.scoped(
  Effect.gen(function* () {
    const res1 = yield* Effect.acquireRelease(open1(), close1)
    const res2 = yield* Effect.acquireRelease(open2(), close2)
    return yield* work(res1, res2)
    // 退出时逆序 release：close2, close1
  })
)
```

---

## 依赖注入（Context + Layer）

```typescript
// 定义 Service
class HttpClient extends Context.Tag("HttpClient")<
  HttpClient,
  { get: (url: string) => Effect.Effect<unknown, NetworkError> }
>() {}

// 使用 Service
const fetchUser = Effect.gen(function* () {
  const http = yield* HttpClient   // 获取实现
  return yield* http.get("/users/1")
})
// 类型：Effect<unknown, NetworkError, HttpClient>

// 提供实现（Layer）
const HttpClientLive = Layer.succeed(HttpClient, {
  get: (url) => Effect.tryPromise({ try: () => fetch(url).then(r => r.json()), catch: () => new NetworkError() })
})

// Layer with resources
const DbLayer = Layer.scoped(
  DbService,
  Effect.acquireRelease(createPool(), (pool) => Effect.promise(() => pool.end()))
)

// 合并 Layers
const AppLayer = Layer.mergeAll(HttpClientLive, DbLayer)

// 运行
Effect.runPromise(program.pipe(Effect.provide(AppLayer)))

// 应用级 runtime
const runtime = ManagedRuntime.make(AppLayer)
const result = await runtime.runPromise(program)
```

---

## Schema（边界验证）

```typescript
import { Schema } from "effect"

// 定义
const User = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  age: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Schema.Date,                        // ISO string → Date
  role: Schema.Literal("admin", "user"),
  tags: Schema.Array(Schema.String),
  meta: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})
type User = Schema.Schema.Type<typeof User>

// 解码（unknown → User）
const decode = Schema.decodeUnknown(User)
const user = yield* decode(apiResponse)    // Effect<User, ParseError, never>

// 编码（User → unknown，序列化）
const encode = Schema.encode(User)
const raw = yield* encode(user)
```

---

## Stream

```typescript
import { Stream } from "effect"

// 创建
Stream.make(1, 2, 3)
Stream.fromEffect(fetchUser)
Stream.tick("1 second")
Stream.async<A, E>((emit) => {
  source.ondata = (d) => emit.single(d)
  source.onerror = (e) => emit.fail(new MyError())
  return Effect.sync(() => source.close())   // cleanup
})

// 处理
stream.pipe(
  Stream.map(a => b),
  Stream.filter(pred),
  Stream.mapEffect((a) => effect(a), { concurrency: 3 }),
  Stream.take(10),
  Stream.catchAll((e) => Stream.empty)
)

// 消费
yield* Stream.runCollect(stream)          // Chunk<A>
yield* Stream.runForEach(stream, handle)  // void
yield* Stream.runFold(stream, init, f)    // A
```

---

## 执行

```typescript
// 主入口
await Effect.runPromise(effect)             // 失败时 throw
const exit = await Effect.runPromiseExit(effect)  // 返回 Exit（不 throw）
Effect.runSync(effect)                      // 同步（只限无异步的 Effect）

// 应用级 ManagedRuntime
import { ManagedRuntime } from "effect"
const rt = ManagedRuntime.make(AppLayer)
await rt.runPromise(program)
await rt.dispose()                          // 关闭时 release 所有 scoped 资源
```

---

## 常见坑速查

| 坑 | 正确做法 |
|----|---------|
| `yield` 忘了加 `*` | `yield* effect`（有星号） |
| `Effect.retry` 和 `Effect.repeat` 混淆 | retry=失败时重试；repeat=成功后重复 |
| release 里用了可能失败的 Effect | 用 `.pipe(Effect.ignoreLogged)` |
| `R !== never` 时 runPromise | 先 `.pipe(Effect.provide(layer))` |
| `Stream.make([1,2,3])` | 应是 `Stream.make(1,2,3)` 或 `Stream.fromIterable` |
| 老博客的 `@effect/schema` 导入 | 现在是 `import { Schema } from "effect"` |
| `_tag` 字段缺失，`catchTag` 匹配不到 | tagged error 必须有 `readonly _tag = "..."` |
