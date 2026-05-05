# 03 错误维度 E：typed error 与 Cause

> **钩子**：TQ 的 `error: unknown` 意味着你每次都在 runtime 猜类型。Effect 把错误变成值，类型系统知道你在处理哪一种，`catchTag` 按 tag 分发，剩余的 E 自动缩小。

## TQ 视角类比

TQ 的 `onError(error)` 里，`error` 是 `unknown`。你要么 `as ApiError`（不安全），要么写一个 `if (error instanceof ApiError)` 判断（每次都手写）。

Effect 的 E 槽位把这件事变成编译期的东西——`catchTag("NotFoundError", ...)` 之后，剩余 E 里 `NotFoundError` 被自动删掉了，不需要你手动跟踪。

## Tagged Error 的约定

Effect 的错误处理依赖一个简单约定：每种错误类型带 `_tag` 字段：

```typescript
// 推荐用 class 定义，_tag 是字面量类型
class NotFoundError {
  readonly _tag = "NotFoundError"
  constructor(readonly id: string) {}
}

class NetworkError {
  readonly _tag = "NetworkError"
  constructor(readonly status: number, readonly url: string) {}
}

class ParseError {
  readonly _tag = "ParseError"
  constructor(readonly message: string) {}
}
```

`_tag` 是字符串字面量类型——这让 TypeScript 能用 discriminated union 的方式缩小类型。

## `catchTag`：按 tag 分发

```typescript
import { Effect } from "effect"

const getUser = (id: string): Effect.Effect<User, NotFoundError | NetworkError, HttpClient> =>
  Effect.gen(function* () {
    // ...
  })

const program = getUser("u-1").pipe(
  // 处理 NotFoundError，返回 guest user（E 里 NotFoundError 被消掉）
  Effect.catchTag("NotFoundError", (e) =>
    Effect.succeed({ id: "guest", name: "Guest" })
  ),
  // 此时 E 只剩 NetworkError
  Effect.catchTag("NetworkError", (e) =>
    Effect.fail(new Error(`Network failed: ${e.status}`))
  )
  // 此时 E 是 never——所有错误都处理了
)
// 最终类型：Effect<User, never, HttpClient>
```

类型系统自动追踪哪些 tag 被 catch 过，剩余的 E 是精确的 union。

## `catchAll`：处理全部错误

```typescript
const safe = getUser("u-1").pipe(
  Effect.catchAll((e) => {
    // e 的类型是 NotFoundError | NetworkError——有类型，不是 unknown
    if (e._tag === "NotFoundError") return Effect.succeed(guestUser)
    return Effect.fail(e)
  })
)
```

## `orElse`：失败时换成另一个 Effect

```typescript
const withFallback = primaryFetch.pipe(
  Effect.orElse(() => fallbackFetch)
)
```

## Cause：failure vs defect

Effect 的错误系统里有一个关键区分，大多数教程跳过了它：

**failure**（你预期的错误）— 进入 E 槽位，你用 catchTag/catchAll 处理。  
**defect**（你没预期的 bug）— 不进入 E 槽位，会穿透所有 catch，最终导致 fiber 中止。

```typescript
// failure：你声明的错误，进 E
Effect.fail(new NotFoundError("u-1"))

// defect：throw 出来的意外，不进 E（穿透）
Effect.sync(() => {
  throw new Error("unexpected!")  // ← 这会成为 defect
})
// 注意：Effect.try() 会把 throw 捕获成 failure，这才是正确的包法
```

`Cause` 类型是 failure/defect/interrupt 的容器：

```typescript
import { Cause, Effect } from "effect"

const withCause = program.pipe(
  Effect.catchAllCause((cause) => {
    if (Cause.isFailure(cause)) {
      // 处理预期错误
    }
    if (Cause.isDie(cause)) {
      // 处理意外 bug（defect）
    }
    return Effect.fail(cause)
  })
)
```

日常代码里你不需要直接操作 Cause——`catchTag` / `catchAll` 已经足够。Cause 在写框架层或者顶层 error boundary 时才需要。

## 错误转换

```typescript
// mapError：变换错误类型（不 recover，只 transform）
const remapped = getUser("u-1").pipe(
  Effect.mapError(e => new HttpError(e._tag, 500))
)

// 把外部库的错误包成 tagged error
const safeRead = Effect.try({
  try: () => JSON.parse(raw),
  catch: (e) => new ParseError(String(e))
})
```

## 故意踩坑：忘了 `_tag`

```typescript
// ❌ 没有 _tag 字段——catchTag 匹配不到
class BadError {
  message: string  // ← _tag 缺了
  constructor(msg: string) { this.message = msg }
}

// Effect.catchTag("BadError", ...) 会报类型错误：
// Type '"BadError"' is not assignable to type '...'
// 因为 tsc 找不到字面量 discriminant

// ✅ 正确：加上 readonly _tag
class GoodError {
  readonly _tag = "GoodError"
  constructor(readonly message: string) {}
}
```

## 自检清单

- [ ] 不看示例，定义三个 tagged error 类型？
- [ ] `catchTag` 之后 E 类型为什么会缩小？（discriminated union 原理）
- [ ] failure 和 defect 的区别是什么？哪种会穿透 `catchAll`？
- [ ] `Effect.try` 和 `Effect.sync` 有什么区别？什么时候用哪个？

**下一章**：错误处理完了，下面是时间和次数的控制——retry、timeout 和 Schedule。→ [04-schedule-retry.md](04-schedule-retry.md)
