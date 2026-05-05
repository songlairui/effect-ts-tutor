# 07 Context.Tag 与 Layer：R 维度的兑现

> **钩子**：这是 Effect 和其他 FP 库最大的区分点。R 维度在前几章一直是签名里的占位符——这章你来学怎么定义它、提供它，以及为什么它能在编译期保证"依赖没有漏"。

## TQ 视角类比

React 里你用 Context 共享 `queryClient`、`supabaseClient`、`featureFlags`——全靠运行时的 `useContext` 和顶层 `Provider`，编译器不知道你有没有忘记包 Provider。

Effect 的 `Context.Tag` + `Layer` 做的是同一件事，但由编译器强制：如果某个 Effect 需要 `HttpClient`，而你没 provide，`runPromise` 之前 tsc 就会报错。`R` 槽位是 `never` 才能跑——这个约束编译期落地。

## 定义 Service：`Context.Tag`

```typescript
import { Context, Effect } from "effect"

// 定义 service 的形状（接口）
interface HttpClientService {
  get: (url: string) => Effect.Effect<unknown, NetworkError>
  post: (url: string, body: unknown) => Effect.Effect<unknown, NetworkError>
}

// 声明 Tag（相当于 React Context 的 createContext，但有类型）
class HttpClient extends Context.Tag("HttpClient")<
  HttpClient,          // Tag 自身的类型（用来引用它）
  HttpClientService    // 实现类型（service 的形状）
>() {}
```

使用时，在 Effect.gen 里 `yield* TagName`：

```typescript
const fetchUser = (id: string) =>
  Effect.gen(function* () {
    const http = yield* HttpClient  // 获取 service 实现
    return yield* http.get(`/users/${id}`)
  })
// 自动推导：Effect<unknown, NetworkError, HttpClient>
```

`HttpClient` 进入了 R 槽位——编译器知道你需要它。

## 提供 Service：`Layer`

Layer 是"如何构建一个 service 的描述"——同样是 cold 的，直到 runtime 才执行：

```typescript
import { Layer } from "effect"

// Layer.succeed：直接提供一个实现（测试或简单场景）
const HttpClientLive = Layer.succeed(HttpClient, {
  get: (url) => Effect.tryPromise({
    try: () => fetch(url).then(r => r.json()),
    catch: (e) => new NetworkError(500, url)
  }),
  post: (url, body) => Effect.tryPromise({
    try: () => fetch(url, { method: "POST", body: JSON.stringify(body) }).then(r => r.json()),
    catch: (e) => new NetworkError(500, url)
  })
})

// Layer.effect：构建时需要执行 Effect（比如初始化 DB 连接池）
const DbLayer = Layer.effect(
  DbService,
  Effect.gen(function* () {
    const pool = yield* createPool({ host: "localhost", max: 10 })
    return { query: (sql) => Effect.promise(() => pool.query(sql)) }
  })
)

// Layer.scoped：构建时需要 Scope（有 release 的资源，见上一章）
const RedisLayer = Layer.scoped(
  RedisService,
  Effect.acquireRelease(
    createRedisClient(),
    (client) => Effect.promise(() => client.quit())
  )
)
```

## 运行：`Effect.provide`

把 Layer provide 给 Effect，R 槽位被消费，缩减为 `never`：

```typescript
const program = fetchUser("u-1").pipe(
  Effect.provide(HttpClientLive)
)
// 类型变成：Effect<User, NetworkError, never>
// 现在可以 runPromise 了

await Effect.runPromise(program)
```

## Layer 组合

多个 service 可以合并成一个 Layer：

```typescript
import { Layer } from "effect"

// merge：合并两个 Layer（顺序不重要）
const AppLayer = Layer.merge(HttpClientLive, DbLayer)

// mergeAll：合并多个
const AllLayers = Layer.mergeAll(HttpClientLive, DbLayer, RedisLayer, LoggerLayer)

// Layer 之间的依赖（A 依赖 B）
const ServiceALayer = Layer.effect(
  ServiceA,
  Effect.gen(function* () {
    const db = yield* DbService  // ServiceA 的构建需要 DbService
    return { doThing: () => db.query("...") }
  })
)
// ServiceALayer 的 R 是 DbService，compose 时会自动解析
const Combined = ServiceALayer.pipe(Layer.provide(DbLayer))
// Combined 的 R 变为 never（依赖已满足）
```

## 测试：换成 Mock Layer

测试时只需把 `Live` Layer 替换成 `Mock`：

```typescript
const HttpClientMock = Layer.succeed(HttpClient, {
  get: (url) => {
    if (url.includes("/users/")) return Effect.succeed({ id: "u-1", name: "Mock User" })
    return Effect.fail(new NetworkError(404, url))
  },
  post: () => Effect.succeed({ ok: true })
})

// 测试时 provide mock
const result = await Effect.runPromise(
  myProgram.pipe(Effect.provide(HttpClientMock))
)
```

编译器会帮你检查 mock 是否覆盖了所有方法——`HttpClientService` 接口的形状必须匹配。

## ManagedRuntime：应用级别的运行时

大应用里会在入口处建立一个带 Layer 的 runtime，而不是每次 runPromise 都 provide：

```typescript
import { ManagedRuntime, Layer } from "effect"

const runtime = ManagedRuntime.make(AllLayers)

// 之后所有 runPromise 都从这个 runtime 跑
const result = await runtime.runPromise(myProgram)

// 应用关闭时，ManagedRuntime 会触发所有 scoped Layer 的 release
await runtime.dispose()
```

## 故意踩坑：忘了 provide

```typescript
// ❌ 没 provide HttpClient 就 runPromise
const program = fetchUser("u-1")
// 类型：Effect<User, NetworkError, HttpClient>

await Effect.runPromise(program)
// tsc 报错：Argument of type 'Effect<User, NetworkError, HttpClient>'
//           is not assignable to parameter of type 'Effect<User, NetworkError, never>'
// 这是 R ≠ never 的编译错误——你没法绕过去跑
```

## 自检清单

- [ ] 不看示例，定义一个 `Logger` service（有 `log(msg: string)` 方法）？
- [ ] 写一个 `Layer.succeed(Logger, { log: ... })` 和一个 Mock Layer？
- [ ] 如果 Service A 依赖 Service B，怎么 compose 两个 Layer？
- [ ] 为什么 R 槽位必须是 `never` 才能 `runPromise`？编译错误长什么样？

**下一章**：依赖注入完成了内部的类型安全。Schema 是边界处的——保证外部数据（API 响应、用户输入）进来时被严格验证和转换。→ [08-schema-boundary.md](08-schema-boundary.md)
