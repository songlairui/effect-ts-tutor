# 02 pipe 与 `Effect.gen`：两副组合面孔

> **钩子**：Effect 有两种风格串联异步逻辑。不是非此即彼——读签名、写 operator chain 用 pipe；写 if/for/try 逻辑用 gen。知道什么时候选哪个，你就理解了 80% 的 Effect 代码。

## TQ 视角类比

TQ 里，单个 `useQuery` 之间几乎没有横向组合工具——想在拿到数据后做下一步，你只能在组件里再 `enabled` 一个新的 query，或者 `useEffect` 一把。Effect 把"先有这个结果才能做那个"表达成了可组合的算子。

## 方式一：`pipe` + operator chain

`pipe(value, fn1, fn2, fn3, ...)` 是一个把值依次送进函数的管道——类似 Unix 的 `|`：

```typescript
import { Effect, pipe } from "effect"

const program = pipe(
  fetchUser("u-1"),                                    // Effect<User, ApiError, Http>
  Effect.map(user => user.name.toUpperCase()),         // Effect<string, ApiError, Http>
  Effect.flatMap(name => saveLog(`Fetched: ${name}`)), // Effect<void, ApiError | DbError, Http | Db>
  Effect.tap(Effect.log("done"))                       // Effect<void, ...> + 打印 log
)
```

每个 operator 接收上一步的 Effect，返回新的 Effect，类型被精确追踪。错误类型自动合并（Union）；依赖类型自动合并（Intersection）。

也可以用方法链（`.pipe()`）——完全等价，只是写法不同：

```typescript
const program = fetchUser("u-1")
  .pipe(
    Effect.map(u => u.name),
    Effect.flatMap(name => saveLog(name)),
    Effect.tap(Effect.log("done"))
  )
```

**常用 operator 速览：**

| Operator | 意思 |
|----------|------|
| `Effect.map(f)` | 变换成功值，不改变 E/R |
| `Effect.flatMap(f)` | 成功后执行另一个 Effect（等于 async/await 的 `.then`） |
| `Effect.tap(f)` | 执行副作用（打 log、send metric），不改变成功值 |
| `Effect.mapError(f)` | 变换错误值 |
| `Effect.orElse(e2)` | 失败时换成 e2 |
| `Effect.andThen(e2)` | 成功后顺序执行 e2（常用替代 flatMap） |

## 方式二：`Effect.gen` + `yield*`

`Effect.gen` 是 Effect 的"async/await 等价物"。内部可以写 if/for/try，和普通 TS 写法几乎一样：

```typescript
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const user = yield* fetchUser("u-1")           // 如果失败，这里直接短路
  const friends = yield* fetchFriends(user.id)   // 顺序执行
  
  if (friends.length === 0) {
    yield* Effect.log("no friends")
    return user
  }
  
  for (const f of friends) {
    yield* notifyUser(f.id, `${user.name} is online`)
  }
  
  return { user, friends }
})
// 类型自动推导：Effect<{user: User, friends: Friend[]}, ApiError, HttpClient>
```

每个 `yield*` 后面跟一个 Effect——成功时把值解包出来，失败时整个 gen 直接短路（和 `await` 遇到 reject 类似，但错误类型是 typed 的）。

**`yield*` 是关键词，不能省成 `yield`：**

```typescript
// ❌ 错误写法：yield（没有星号）
const user = yield fetchUser("u-1")
// 类型报错，因为 fetchUser 返回 Effect，不是 Generator

// ✅ 正确写法：yield*
const user = yield* fetchUser("u-1")
```

## 两种方式的选用原则

| 用 pipe | 用 gen |
|---------|--------|
| 简单的线性 transform chain | 含分支（if/switch） |
| 复用 operator 库（retry/timeout/tap 组合） | 含循环（for/while/reduce） |
| 阅读签名时强调类型转换 | 含多步顺序依赖，逻辑较长 |
| 写 operator helper（给别人调的函数） | 写主流程的"步骤" |

实践中 gen 是主战场，pipe 是给它套外衣（加 retry/timeout/tap/catchTag 等）：

```typescript
// gen 写主逻辑，pipe 套 operator
const program = pipe(
  Effect.gen(function* () {
    const user = yield* fetchUser(id)
    const profile = yield* loadProfile(user.id)
    return { user, profile }
  }),
  Effect.retry({ times: 3 }),
  Effect.timeout("5 seconds"),
  Effect.catchTag("NotFoundError", () => Effect.succeed(guestProfile))
)
```

## 自检清单

- [ ] 不看示例，用 `pipe` 写一个"fetch user → log name → save to db"的三步 chain？
- [ ] 用 `Effect.gen` 改写同样的三步逻辑？
- [ ] `yield` 和 `yield*` 有什么区别？如果写错了 tsc 会报什么？
- [ ] 为什么 gen 里多个 `yield*` 的错误类型会自动合并到最终签名里？

**下一章**：现在你会串 Effect 了，但错误怎么处理？E 维度是 Effect 最有价值的部分之一。→ [03-error-channel.md](03-error-channel.md)
