# 10 与 TQ / React 共存：实战拼装

> **钩子**：Effect 不是要替换 TQ，而是填补它覆盖不到的那一半。这章讲怎么在实际 React 项目里让两者共存——TQ 留在原位，Effect 进驻 service 层。

## 最重要的分层原则

```
┌─────────────────────────────────────────┐
│          React 组件层                    │
│  useQuery / useMutation / UI 状态       │  ← TQ 的领地，不动
├─────────────────────────────────────────┤
│          Effect 编排层                  │
│  复杂 mutation、retry、并发、Stream     │  ← Effect 进来的地方
├─────────────────────────────────────────┤
│          Service / IO 层               │
│  HttpClient, DbClient, AuthService     │  ← Effect Layer 定义的东西
└─────────────────────────────────────────┘
```

**TQ 继续管**：组件数据订阅、缓存失效、Suspense 集成、乐观更新、refetch on focus。  
**Effect 接管**：复杂 mutation 编排、按错误类型分 retry、SSE/WebSocket、有资源生命周期的操作、需要依赖注入测试的业务逻辑。

## 接入方式一：`runPromise` in `queryFn`

最简单，零 magic——把 TQ 当 Effect 的执行壳：

```typescript
import { Effect } from "effect"
import { useQuery, useMutation } from "@tanstack/react-query"

// 这个 Effect 包含了所有 retry/timeout/Schema 验证逻辑
const fetchUserEffect = (id: string) =>
  fetchUser(id).pipe(          // 自己写的 Effect
    Effect.retry(backoffSchedule),
    Effect.timeoutFail({ duration: "5 seconds", onTimeout: () => new TimeoutError() }),
    Effect.provide(HttpClientLive)  // 在 query 边界 provide 依赖
  )

// useQuery 里直接 runPromise
function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => Effect.runPromise(fetchUserEffect(id))
  })
}
```

TQ 负责缓存和 Suspense；Effect 负责 retry 策略和类型安全的错误处理。

```typescript
// mutation 同理
function useUpdateProfile() {
  return useMutation({
    mutationFn: (data: UpdateProfileInput) =>
      Effect.runPromise(
        updateProfile(data).pipe(
          Effect.andThen(invalidateRelatedCaches),
          Effect.retry({ schedule: Schedule.recurs(2), while: (e) => e._tag === "NetworkError" }),
          Effect.provide(AppLayer)
        )
      )
  })
}
```

## 接入方式二：在 App 入口建立 Runtime

对于中大型应用，在组件里每次 `Effect.provide(AppLayer)` 比较冗余——而且 Layer 里有资源（DB 连接、Redis 等），每次重建浪费。更好的做法是在应用入口建立一个 `ManagedRuntime`：

```typescript
// src/runtime.ts
import { ManagedRuntime, Layer } from "effect"

const AppLayer = Layer.mergeAll(
  HttpClientLive,
  AuthServiceLive,
  LoggerLive
)

export const appRuntime = ManagedRuntime.make(AppLayer)

// 导出一个已经绑定了 Layer 的 runPromise
export const run = <A, E>(effect: Effect.Effect<A, E, Layer.Layer.Success<typeof AppLayer>>) =>
  appRuntime.runPromise(effect)
```

```typescript
// 组件里用 run 代替 runPromise
function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => run(fetchUser(id))  // 不再需要 provide
  })
}
```

## 接入方式三：`@effect-rx/rx-react`

如果你的项目里 Effect 用量较大，可以考虑 `@effect-rx/rx-react`——它提供了 `Rx`（类似 TQ 的 atom）的 Effect 原生绑定：

```typescript
import { Rx } from "@effect-rx/rx-react"

// 定义一个 Rx atom（类似 TQ 的 query）
const userRx = Rx.fn((id: string) => fetchUser(id))

// 在组件里用
function UserCard({ id }: { id: string }) {
  const [user] = Rx.useRx(userRx(id))
  // 类似 useQuery，自动处理 loading/error/data
}
```

`@effect-rx/rx-react` 适合"已经决定以 Effect 为核心"的架构，不需要 TQ。如果你已经深度用了 TQ，先用方式一/二足够。

## 分层决策树

```
是否需要跨组件缓存？
├─ 是 → 用 TQ（或 TQ + Effect in queryFn）
└─ 否 → 是否是简单一次性读取？
         ├─ 是 → Effect.runPromise 直接用
         └─ 否 → 是否涉及流/WebSocket/SSE？
                  ├─ 是 → Stream + @effect-rx 或自定义 hook
                  └─ 否 → Effect 编排 + runPromise in mutationFn
```

## Layer 在 React 里的位置

React Context 和 Effect Layer 的职责分离：

```typescript
// React Context：UI 状态（主题、语言、modal state）
const ThemeContext = createContext<Theme>()

// Effect Layer：业务 service（HTTP client、auth、feature flags）
const AppLayer = Layer.mergeAll(HttpClientLive, AuthServiceLive)
// 这些不需要进 React Context，在 runtime.ts 里管
```

不要把 Effect service 放进 React Context——那是两套系统，混在一起会失去 Effect 依赖注入的编译期检查。

## 错误边界对接

Effect 的 typed error 如何和 React Error Boundary 配合：

```typescript
// 在 queryFn 边界把 Effect Error 转成可处理的 JS Error
queryFn: () =>
  Effect.runPromise(
    myEffect.pipe(
      Effect.catchAll((e) => Effect.fail(new Error(JSON.stringify(e))))
    )
  )
// TQ 的 error 是 Error | null，Effect 的 typed error 在这里被序列化
```

或者用 TQ 的 `useQueryErrorResetBoundary` + Effect 的 `Exit` 做更精细的处理。

## 自检清单

- [ ] 能描述 TQ 和 Effect 在一个 React 项目里各管什么层？
- [ ] 用 `runPromise` 把 Effect 接进 `queryFn` 的模式是什么？
- [ ] 为什么要在入口建立 `ManagedRuntime` 而不是每次 `provide`？
- [ ] 什么情况下你会考虑 `@effect-rx/rx-react` 而不是 TQ？

**下一章**：完整路径走完了。收尾：API 漂移的告诫、14.ai 案例、cheatsheet，以及如何让 AI 助手写出靠谱的 Effect 代码。→ [11-coda.md](11-coda.md)
