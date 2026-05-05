# 01 `Effect<A, E, R>`：三维签名

> **钩子**：Promise 只有一个维度（成功值）。Effect 用三维签名把你之前在类型外面猜的两件事——"会不会错"和"需要什么"——都塞进了类型里。

## TQ 视角类比

TQ 的 `queryFn` 签名是 `() => Promise<TData>`，error 是 `unknown`，依赖是"隐式 import 进来的"。你每次都在类型外面猜：这个会抛什么？它用了哪个全局 client？

Effect 的等价物是 `Effect<TData, TError, TDeps>`。三件事都进了类型签名，没有外面的猜测。

## Cold vs Hot

**Promise 是 hot**：创建即执行。

```typescript
const p = fetch("/api/user") // ← 这里已经发了网络请求
```

**Effect 是 cold**：创建时什么都不发生，只有交给 runtime 才跑。

```typescript
import { Effect } from "effect"

const fetchUser = Effect.tryPromise({
  try: () => fetch("/api/user").then(r => r.json()),
  catch: (e) => new Error(String(e))
})
// ← 这里什么都没发生。fetchUser 是一个描述。

Effect.runPromise(fetchUser) // ← 这里才真正执行
```

cold 是组合的前提：只有还没跑的东西，才能被安全地包上 retry、timeout、race。一个已经跑过的 Promise，你没法再加 retry 到"那一次执行"上面去。

## 三个槽位详解

### A：成功值类型

```typescript
Effect<User, never, never>  // 一定成功，返回 User
Effect<void, never, never>  // 一定成功，没有返回值（纯副作用）
```

`never` 在 E 槽位意味着"不会错"，在 R 槽位意味着"不需要任何外部依赖"。Effect 简写里常见 `Effect.Effect<A>` 表示 `Effect<A, never, never>`。

### E：失败值类型（typed error）

TQ 的 `error` 是 `unknown`——你只能在 onError 里强转或猜类型。Effect 的 E 是精确的：

```typescript
class NotFoundError {
  readonly _tag = "NotFoundError"
  constructor(readonly id: string) {}
}

class NetworkError {
  readonly _tag = "NetworkError"
  constructor(readonly status: number) {}
}

// 类型签名告诉你这个 effect 可能产生两种错误
const getUser = (id: string): Effect.Effect<User, NotFoundError | NetworkError, HttpClient> =>
  ...
```

`_tag` 字段是 Effect 的约定，用来让 `catchTag` 按字段分发（见第 03 章）。

### R：运行时依赖

这是 TQ 完全没有的维度。R 槽位列出了"这段 Effect 跑起来需要什么 service"：

```typescript
Effect<User, ApiError, HttpClient | Logger>
                       ^^^^^^^^^^^^^^^^
                       两个 service 都要 provide，缺一个就编译报错
```

R 为 `never`（写作 `Effect<A, E>`）表示随时可以直接 `runPromise`。

## 创建 Effect 的五种方式

```typescript
import { Effect } from "effect"

// 1. 纯成功值（无副作用）
const pure = Effect.succeed(42)
// Effect<number, never, never>

// 2. 纯失败值
const fail = Effect.fail(new NotFoundError("user-1"))
// Effect<never, NotFoundError, never>

// 3. 包裹同步副作用（可能 throw）
const readFile = Effect.try({
  try: () => require("fs").readFileSync("/etc/hosts", "utf8"),
  catch: (e) => new Error(String(e))
})
// Effect<string, Error, never>

// 4. 包裹 Promise（可能 reject）
const fetchData = Effect.tryPromise({
  try: () => fetch("/api").then(r => r.json()),
  catch: (e) => new NetworkError(500)
})
// Effect<unknown, NetworkError, never>

// 5. 包裹同步副作用（假设不会 throw，你自己担保）
const now = Effect.sync(() => Date.now())
// Effect<number, never, never>
```

## 执行 Effect

不到 `run*` 那一行，什么都不发生：

```typescript
// 最常用：给 Promise 用
await Effect.runPromise(myEffect)

// 同步执行（只能用于没有异步的 Effect）
Effect.runSync(myEffect)

// 获得 Exit（成功或失败的容器）
const exit = await Effect.runPromiseExit(myEffect)
```

## 常见误区

```typescript
// ❌ 错误理解：以为这会立刻发送请求
const e = Effect.tryPromise({
  try: () => fetch("/api"),
  catch: () => new Error()
})
// 不会。e 只是一个描述。

// ❌ 忘了 yield*，只写了 yield
Effect.gen(function* () {
  const user = yield fetchUser  // 类型会报错：fetchUser 不是 Generator
  // 应该是 yield* fetchUser
})
```

## 自检清单

- [ ] 不看资料，能写出包裹一个 `fetch()` 调用的 `Effect.tryPromise`？
- [ ] `Effect<string, never, never>` 和 `Promise<string>` 的最大区别是什么？
- [ ] R 槽位是 `never` 意味着什么？R 槽位有值意味着什么？
- [ ] 为什么 cold 是组合的前提？能举一个 hot 的 Promise 没法加 retry 的反例？

**下一章**：学会创建 Effect 了，现在来学怎么把它们组合起来——pipe 和 `Effect.gen` 两副面孔。→ [02-pipe-and-gen.md](02-pipe-and-gen.md)
