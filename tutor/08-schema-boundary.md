# 08 Schema：边界处的硬墙

> **钩子**：API 响应是 `unknown`。你每次要么 `as User`（不安全），要么写一个手动校验函数（繁琐）。Schema 在系统边界处建立硬墙——unknown 进去，类型化值出来，转换失败就是 typed error，整个过程双向的。

## TQ 视角类比

TQ 的 `queryFn` 返回的数据类型你自己声明——但 runtime 不会验证 API 真的返回了那个形状。如果 API 字段改了，你在 ts 层面察觉不到，直到某处 `.name` 在 runtime 是 `undefined`。

Schema 让"API 响应 → TypeScript 类型"这个过程可靠：

```typescript
import { Schema, Effect } from "effect"

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  createdAt: Schema.Date  // 自动从 ISO string 转成 Date 对象
})

type User = Schema.Schema.Type<typeof User>
// User = { id: string; name: string; email: string; createdAt: Date }

const decodeUser = Schema.decodeUnknown(User)
// (unknown) => Effect<User, ParseError, never>
```

`decodeUnknown` 返回 Effect，失败类型是结构化的 `ParseError`——能精确指出是哪个字段、哪个约束失败了。

## Schema 基础：构造器

```typescript
import { Schema } from "effect"

// 基本类型
Schema.String
Schema.Number
Schema.Boolean
Schema.Date          // 接受 Date 或 ISO string，统一输出 Date
Schema.Null
Schema.Undefined
Schema.Unknown
Schema.Any

// 字面量
Schema.Literal("admin", "user", "guest")  // "admin" | "user" | "guest"

// 复合类型
Schema.Struct({ id: Schema.String, age: Schema.Number })
Schema.Array(Schema.String)
Schema.Tuple(Schema.String, Schema.Number)
Schema.Record(Schema.String, Schema.Number)
Schema.Union(UserSchema, GuestSchema)
Schema.Optional(Schema.String)            // string | undefined
Schema.NullOr(Schema.String)              // string | null
Schema.NullishOr(Schema.String)           // string | null | undefined
```

## Refinement（细化约束）

```typescript
const Email = Schema.String.pipe(
  Schema.filter((s) => s.includes("@"), {
    message: () => "must be a valid email"
  })
)

const PositiveInt = Schema.Number.pipe(
  Schema.int(),       // 必须是整数
  Schema.positive()   // 必须 > 0
)

const NonEmptyString = Schema.String.pipe(
  Schema.minLength(1)
)
```

## Transform（双向转换）

Schema 的核心差异 vs zod：**双向**。不只是解码（decode），也能编码（encode）：

```typescript
// Date ↔ ISO string 的双向转换（内置）
const DateFromString = Schema.Date
// decode: "2026-01-01T00:00:00Z" → Date
// encode: Date → "2026-01-01T00:00:00Z"

// 自定义 transform
const TrimmedString = Schema.transform(
  Schema.String,    // from（输入）
  Schema.String,    // to（输出）
  {
    decode: (s) => s.trim(),              // string → string（decode 方向）
    encode: (s) => s                       // string → string（encode 方向）
  }
)

// 完整的 API 对象转换（蛇形 → 驼峰）
const ApiUser = Schema.transform(
  Schema.Struct({ user_id: Schema.String, created_at: Schema.Date }),
  Schema.Struct({ userId: Schema.String, createdAt: Schema.Date }),
  {
    decode: ({ user_id, created_at }) => ({ userId: user_id, createdAt: created_at }),
    encode: ({ userId, createdAt }) => ({ user_id: userId, created_at: createdAt })
  }
)
```

## 在 Effect 里使用 Schema

```typescript
import { Schema, Effect } from "effect"

// decode：unknown → Effect<User, ParseError>
const parseUser = Schema.decodeUnknown(User)

// encode：User → Effect<unknown, ParseError>（序列化）
const encodeUser = Schema.encode(User)

// 实战：queryFn 里用 Schema 验证
const fetchUser = (id: string) =>
  Effect.gen(function* () {
    const http = yield* HttpClient
    const raw = yield* http.get(`/users/${id}`)  // Effect<unknown, NetworkError, HttpClient>
    const user = yield* parseUser(raw)            // Effect<User, ParseError, never>
    return user
  })
// 类型：Effect<User, NetworkError | ParseError, HttpClient>
// ParseError 自动合并进 E 槽位——类型系统知道这里可能解析失败
```

## ParseError：结构化的失败信息

```typescript
import { Schema, ParseResult } from "effect"

const result = await Effect.runPromiseExit(parseUser({ id: 123 }))
// Exit.Failure，ParseError 里包含：
// - message: "id: Expected string, actual 123"
// - 精确的字段路径
// - actual vs expected 对比
```

不是 `"validation failed"` 这种无信息的错误。

## Schema 的位置：只在边界

Schema 的使用原则：**只在系统边界用，内部函数不用**。边界包括：

- API 响应进来的地方（`queryFn`、tRPC handler 的输出）
- 用户输入进来的地方（form submit、URL params）
- 存储读出来的地方（localStorage、DB 查询结果）
- 发出去到外部系统的地方（encode 方向）

内部模块之间传的值已经是 typed 的，不需要再验证。

## 故意踩坑：直接 `as` 类型断言

```typescript
// ❌ 不安全：API 结构改了你察觉不到
const user = response.data as User

// ❌ 使用 zod 的人习惯 .parse()，但它 throw，不进 E 槽位
const user = UserZod.parse(response.data)  // 如果失败，变成 defect

// ✅ Schema.decodeUnknown 失败进 E 槽位，可以 catchTag("ParseError", ...)
const user = yield* Schema.decodeUnknown(User)(response.data)
```

## 自检清单

- [ ] 不看示例，用 `Schema.Struct` 定义一个有日期字段的 API 响应类型？
- [ ] `Schema.Date` 的 decode 和 encode 方向分别做什么？
- [ ] 为什么 `Schema.decodeUnknown` 比 `throw` 更适合 Effect 的错误体系？
- [ ] Schema 应该用在哪些地方？内部函数之间要加 Schema 验证吗？

**下一章**：单个值学完了。Stream 是"多个值随时间到来"——SSE、WebSocket、分页、轮询的抽象。→ [09-stream.md](09-stream.md)
