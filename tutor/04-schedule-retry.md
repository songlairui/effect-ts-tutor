# 04 Schedule、retry 与 timeout：时间的控制

> **钩子**：TQ 的 `retry: 3` 只是个数字。Effect 的 Schedule 是一个可组合的"时间策略"——你可以声明"指数退避 + jitter + 最多 5 次 + 只在 NetworkError 时重试"，用一行类型安全的声明表达。

## TQ 视角类比

TQ 提供 `retry: 3`（重试次数）和 `retryDelay`（固定延迟或函数）。有一定的灵活性，但不可组合——你没法把一个 retry 策略像函数一样传来传去、组合成新策略。

Effect 的 Schedule 是一个独立的类型，可以像 Effect 一样 pipe 组合：

```typescript
import { Schedule } from "effect"

const mySchedule = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,                    // 加随机 jitter（防止 thundering herd）
  Schedule.intersect(Schedule.recurs(4)) // 最多 4 次
)
```

`mySchedule` 是一个可以复用、可以传参、可以写测试的值。

## `Schedule` 基础构造器

```typescript
import { Schedule, Duration } from "effect"

// 固定间隔
Schedule.spaced("500 millis")
Schedule.spaced(Duration.millis(500))  // 等价写法

// 指数退避（100ms, 200ms, 400ms, ...）
Schedule.exponential("100 millis")

// 只重复 N 次（无延迟）
Schedule.recurs(3)

// 永远重复
Schedule.forever

// 到某个时间点为止
Schedule.upTo(Duration.minutes(5))
```

## Schedule 组合

Schedule 的真正价值在组合：

```typescript
import { Schedule } from "effect"

// intersect（交集）：两个策略都满足才继续
// 相当于"指数退避 AND 最多 4 次"
const backoff4 = Schedule.exponential("200 millis").pipe(
  Schedule.intersect(Schedule.recurs(4))
)

// union（并集）：任一策略满足就继续（通常用来取最大间隔）
const withCap = Schedule.exponential("100 millis").pipe(
  Schedule.union(Schedule.spaced("10 seconds"))
  // 间隔取两者中的较小值：指数增长，但上限 10s
)

// 加 jitter（让每次延迟在 ±50% 内随机抖动）
const jittered = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(5))
)
```

## `Effect.retry`：失败时按 schedule 重试

```typescript
import { Effect, Schedule } from "effect"

const robustFetch = fetchUser("u-1").pipe(
  Effect.retry(Schedule.exponential("100 millis").pipe(
    Schedule.intersect(Schedule.recurs(3))
  ))
)
```

只有 failure（E 槽位的错误）会触发 retry；defect 会穿透。如果你只想在特定错误类型时重试：

```typescript
// 只在 NetworkError 时重试
const selective = fetchUser("u-1").pipe(
  Effect.retry({
    schedule: Schedule.exponential("200 millis").pipe(
      Schedule.intersect(Schedule.recurs(3))
    ),
    while: (e) => e._tag === "NetworkError"
  })
)
```

## `Effect.timeout`：超时限制

```typescript
import { Effect } from "effect"

const withTimeout = slowOperation.pipe(
  Effect.timeout("3 seconds")
)
// 成功时：Effect<Option<A>, E, R>（Some 表示在时间内完成，None 表示超时）

// 更常用的写法——超时当作 failure
const withTimeoutFail = slowOperation.pipe(
  Effect.timeoutFail({
    duration: "3 seconds",
    onTimeout: () => new TimeoutError("took too long")
  })
)
```

## `Effect.repeat`：成功时重复（vs retry 是失败时重试）

```typescript
import { Effect, Schedule } from "effect"

// 每 5 秒轮询一次，永远
const poll = checkStatus.pipe(
  Effect.repeat(Schedule.spaced("5 seconds"))
)

// 重复 10 次后停止
const tenTimes = effect.pipe(
  Effect.repeat(Schedule.recurs(10))
)
```

## 组合示例：完整的生产级 fetch

```typescript
import { Effect, Schedule } from "effect"

const schedule = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(4))
)

const production = fetchUser(id).pipe(
  Effect.retry({
    schedule,
    while: (e) => e._tag === "NetworkError"  // 只在网络错误时重试
  }),
  Effect.timeoutFail({
    duration: "10 seconds",
    onTimeout: () => new TimeoutError("request timed out")
  }),
  Effect.tap((user) => Effect.log(`fetched user ${user.id}`)),
  Effect.catchTag("NotFoundError", () => Effect.succeed(guestUser))
)
```

这一整段是一个 cold Effect——没有跑，只是在声明策略。你可以把它存成一个变量、传进测试、或者给它再套一层 retry。

## 故意踩坑：retry 和 repeat 混淆

```typescript
// ❌ 想要"失败时重试"，用了 repeat
effect.pipe(Effect.repeat(schedule))
// repeat 是成功后重复，失败会直接短路

// ❌ 想要"成功后轮询"，用了 retry
effect.pipe(Effect.retry(schedule))
// retry 是失败时重试，成功后就停

// ✅ 失败重试 → retry；成功重复 → repeat
```

## 自检清单

- [ ] 不看示例，写出"指数退避 100ms 起步，加 jitter，最多重试 3 次"的 Schedule？
- [ ] `retry` 和 `repeat` 的触发条件各是什么？
- [ ] `Effect.timeout` 和 `Effect.timeoutFail` 的区别？返回类型有何不同？
- [ ] 为什么 Schedule 是可组合的"值"比 TQ 的 `retryDelay` 函数更强大？

**下一章**：学完时间控制，下面是空间控制——如何让多个 Effect 并发跑，以及 fiber 的取消语义。→ [05-fiber-concurrency.md](05-fiber-concurrency.md)
