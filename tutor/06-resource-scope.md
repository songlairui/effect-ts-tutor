# 06 资源与 Scope：`acquireRelease`

> **钩子**：数据库连接、文件 handle、WebSocket——这些资源的 acquire 和 release 必须配对，就算中间抛了错、或者 fiber 被取消，release 也必须跑。`acquireRelease` 用类型把这个约束编码进去。

## TQ 视角类比

TQ 没有资源管理的概念——它只管数据读取，不管"拿到之后要归还"的东西。React 里你通常在 useEffect 的 cleanup 函数里做这件事，但 cleanup 只在组件卸载时跑，不在 `throw` 时跑，也不在取消时跑。Effect 的 `acquireRelease` 在任何退出场景下都保证 release 执行。

## 核心模式：`Effect.acquireRelease`

```typescript
import { Effect } from "effect"

// 三件事：acquire（获取资源）+ use（使用资源）+ release（释放资源）
const withDbConnection = Effect.acquireUseRelease(
  openConnection(),                         // Effect<Connection, DbError, never>（acquire）
  (conn) => doWorkWith(conn),               // Connection -> Effect<A, E, R>（use）
  (conn) => Effect.promise(() => conn.close()) // Connection -> Effect<void, never, never>（release）
)
```

release 的特点：
- **不管 use 是成功还是失败，release 一定会跑**
- **release 本身不应该失败**——如果失败，会变成 defect（记住上一章：defect 穿透）

## `Scope`：手动管理资源生命周期

当你需要在多个地方 acquire 资源，但想让 scope 统一管理 release：

```typescript
import { Effect, Scope } from "effect"

// 把一个资源注册到当前 Scope 里
const acquireConn = Effect.acquireRelease(
  openConnection(),
  (conn) => Effect.promise(() => conn.close())
)
// 类型：Effect<Connection, DbError, Scope>
// 需要 Scope 才能 run——Scope 会在合适时机触发 release

// 用 Effect.scoped 提供 Scope，并在完成后自动关闭
const program = Effect.scoped(
  Effect.gen(function* () {
    const conn1 = yield* acquireConn  // acquire #1，注册到 scope
    const conn2 = yield* acquireConn  // acquire #2，注册到 scope
    // 用 conn1, conn2 做事
    return yield* query(conn1, "SELECT 1")
    // gen 退出时，scope 自动按逆序 release conn2, conn1
  })
)
```

## Finalizer 顺序：逆序释放

```typescript
// 注册顺序：A → B → C
// 释放顺序：C → B → A（栈式，LIFO）
// 这和 try/finally 嵌套的行为一致
```

如果 `use` 中途抛了错（failure 或 defect），Scope 仍会按逆序 release 已注册的资源。

## 常见资源模式

```typescript
import { Effect, Layer } from "effect"

// 模式 1：scoped 本地资源（函数内用完即释放）
const readFile = Effect.scoped(
  Effect.gen(function* () {
    const fd = yield* Effect.acquireRelease(
      Effect.sync(() => openFd("/tmp/data")),
      (fd) => Effect.sync(() => closeFd(fd))
    )
    return yield* readFd(fd)
  })
)

// 模式 2：Layer 里的长生命周期资源（应用级别，在 Layer 关闭时释放）
const DbLayer = Layer.scoped(
  DbService,
  Effect.acquireRelease(
    createPool({ max: 10 }),
    (pool) => Effect.promise(() => pool.end())
  )
)
// Layer 的生命周期由 ManagedRuntime 管理（见第 07 章）
```

## 故意踩坑：release 里的错误

```typescript
// ❌ release 里用了可能失败的 Effect.fail
Effect.acquireRelease(
  openConnection(),
  (conn) => Effect.fail(new Error("release failed!"))  // ← 变成 defect
)
// release 的失败会变成 defect，穿透整个程序

// ✅ release 里用 Effect.ignoreLogged（释放失败就记 log，不 propagate）
Effect.acquireRelease(
  openConnection(),
  (conn) => Effect.promise(() => conn.close()).pipe(
    Effect.ignoreLogged  // 失败了打 log 但不抛
  )
)
```

## 自检清单

- [ ] 不看示例，用 `Effect.acquireUseRelease` 写一个"打开文件 → 读内容 → 关闭文件"的 Effect？
- [ ] Scope 里多个资源的 release 顺序是什么？为什么要逆序？
- [ ] release 函数失败了会怎样？正确的处理方式是什么？
- [ ] `Effect.scoped` 和直接 `Effect.acquireUseRelease` 哪个更适合多资源场景？

**下一章**：你已经掌握了副作用的所有基础控制。现在来看 R 维度——如何用 `Context.Tag` 和 `Layer` 实现类型安全的依赖注入。→ [07-context-layer.md](07-context-layer.md)
