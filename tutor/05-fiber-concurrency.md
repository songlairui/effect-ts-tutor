# 05 并发与 Fiber：`Effect.all` / `race` / `fork`

> **钩子**：Promise.all 和 Promise.race 你用过，但它们对取消一无所知——race 赢了，输的那个 Promise 还在后台默默跑。Effect 的 fiber 解决了这件事：取消是一等公民，自动级联传播。

## TQ 视角类比

TQ 用 `Promise.all` 组合多个 query，`enabled: false` 取消 query，但取消只能在 React 层做，下游的 `fetch` 链没有保障。Effect 的取消信号沿着整个 fiber 树传播，`finally` / `acquireRelease` 保证资源释放（下一章详讲资源部分）。

## `Effect.all`：并发执行多个 Effect

```typescript
import { Effect } from "effect"

// 并行执行（默认），全部成功才继续
const [user, settings, posts] = yield* Effect.all([
  fetchUser(id),
  fetchSettings(id),
  fetchPosts(id)
])
// 类型：Effect<[User, Settings, Post[]], ApiError, HttpClient>
// 任一失败则整体失败，其他 fiber 自动取消

// 有名字的版本（更常用）
const { user, settings } = yield* Effect.all({
  user: fetchUser(id),
  settings: fetchSettings(id)
})
```

**concurrency 控制：**

```typescript
// 默认 "inherit"（从上层 context 继承）
Effect.all(effects)

// 顺序执行（不并发）
Effect.all(effects, { concurrency: 1 })

// 最多 3 个并发
Effect.all(effects, { concurrency: 3 })

// 无限并发
Effect.all(effects, { concurrency: "unbounded" })
```

## `Effect.forEach`：批量处理

```typescript
import { Effect } from "effect"

const ids = ["u-1", "u-2", "u-3", "u-4", "u-5"]

// 顺序处理
const users = yield* Effect.forEach(ids, fetchUser, { concurrency: 1 })

// 并发 2 个
const users2 = yield* Effect.forEach(ids, fetchUser, { concurrency: 2 })

// 全部并发
const users3 = yield* Effect.forEach(ids, fetchUser, { concurrency: "unbounded" })
```

## `Effect.race`：竞速

```typescript
import { Effect } from "effect"

// 谁先成功就用谁的结果，输的那个 fiber 自动取消
const fastest = yield* Effect.race(
  fetchFromPrimaryServer(id),
  fetchFromCdnServer(id)
)

// raceAll：多选一
const first = yield* Effect.raceAll([
  fetchFromRegion("us-east"),
  fetchFromRegion("eu-west"),
  fetchFromRegion("ap-south")
])
```

**和 Promise.race 的关键区别**：Promise.race 输的那个 Promise 继续跑（你管不到它）。Effect.race 输的那个 fiber 收到 interrupt 信号，内部有 `acquireRelease` / finalizer 的话会安全收尾。

## Fiber：轻量级绿色线程

大部分时候你不需要直接操作 Fiber。但了解它是理解取消语义的前提：

```typescript
import { Effect, Fiber } from "effect"

// fork：在后台启动一个 fiber，立刻返回 fiber handle
const fiber = yield* Effect.fork(longRunningTask)
// fiber 类型：Fiber.RuntimeFiber<A, E>

// 等 fiber 完成
const result = yield* Fiber.join(fiber)

// 取消 fiber
yield* Fiber.interrupt(fiber)

// 等 fiber 但超时则取消
const result2 = yield* Fiber.join(fiber).pipe(
  Effect.timeout("5 seconds"),
  Effect.interruptible
)
```

## 取消语义：interrupt 是一等公民

```typescript
// 当父 fiber 被取消，子 fiber 自动取消（默认行为）
const parent = Effect.gen(function* () {
  const child = yield* Effect.fork(longTask)
  yield* Effect.sleep("1 second")
  // 父 fiber 如果被 interrupt，child 也会收到 interrupt
})

// 标记某段 Effect 为不可中断（必须完成才能被 cancel）
const uninterruptible = criticalCleanup.pipe(
  Effect.uninterruptible
)

// 标记某段为可中断（即使在不可中断的上下文里）
const interruptible = checkStatus.pipe(
  Effect.interruptible
)
```

## 实战模式：超时 + 取消

```typescript
import { Effect } from "effect"

// 同时发起主请求和超时计时，谁先完成用谁
const withTimeout = Effect.race(
  actualRequest,
  Effect.sleep("3 seconds").pipe(
    Effect.andThen(Effect.fail(new TimeoutError()))
  )
)
// 实际上 Effect.timeoutFail 就是这个模式的封装
```

## 故意踩坑：忘了 concurrency 默认行为

```typescript
// ❌ 以为默认是并发无限——实际是 "inherit"（可能是顺序）
const users = yield* Effect.all(ids.map(fetchUser))
// 如果上层 context 没设并发，这可能是顺序执行

// ✅ 明确声明
const users = yield* Effect.all(ids.map(fetchUser), { concurrency: "unbounded" })
```

```typescript
// ❌ 以为 fork 之后等 join 和直接 await 没区别
const result = yield* Fiber.join(yield* Effect.fork(task))
// 区别在于：fork 让你可以在等待期间做其他事，或者 interrupt 掉

// 如果只是想顺序执行，直接 yield* task 即可，不需要 fork/join
```

## 自检清单

- [ ] `Effect.all` 和 `Effect.all({ concurrency: 1 })` 的执行顺序有什么区别？
- [ ] `Effect.race` 里输的那个 fiber 会发生什么？和 Promise.race 的区别？
- [ ] 什么情况下需要直接使用 `Effect.fork`？（什么时候不能用 `all`/`race` 代替？）
- [ ] `Effect.uninterruptible` 的使用场景是什么？

**下一章**：并发 + 取消解决了"时间"和"空间"的控制，但还差"资源"——打开的文件、DB 连接、WebSocket 怎么保证安全释放？→ [06-resource-scope.md](06-resource-scope.md)
