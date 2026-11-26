# 接口契约（v1.0 · 冻结候选）

所有类型以 `src/core/types.ts` 为准；本文件只说明「谁实现、输入输出是什么、怎么算通过」。

## 1. 文件地图与责任人

| 文件 | 内容 | 责任人 |
|---|---|---|
| `src/core/types.ts` | 全局类型，只加不改 | 成员1 |
| `src/core/validate.ts` | 状态校验、need 派生、向量格式化 | 成员1 |
| `src/core/state.ts` | 状态深拷贝，保证纯函数 | 成员1 |
| `src/core/safety.ts` | `checkSafety` | 成员2 |
| `src/core/request.ts` | `handleRequest`、`releaseResources` | 成员3 |
| `src/core/deadlock.ts` | `detectDeadlock` | 成员4 |
| `src/core/evidence.ts` | 证据 bundle 与 Markdown 摘要 | 成员6 |
| `src/App.tsx`、`src/styles.css` | 页面与交互 | 成员5 |
| `src/components/EvidencePanel.tsx` | 证据导出与轨迹列表 | 成员5/6 |
| `cases/*.json` | 唯一案例数据源 | 成员4 |
| `scripts/checker.*` | 独立复核实现 | 成员6 |

## 2. 四个核心函数

```ts
checkSafety(state: SystemState): SafetyResult

handleRequest(state: SystemState, processId: ProcessId, request: number[]): RequestOutcome

releaseResources(state: SystemState, processId: ProcessId, release: number[]): ReleaseOutcome

detectDeadlock(state: SystemState): DeadlockResult
```

约束：

- 全部为纯函数，不修改入参，返回新对象。
- 不依赖 React、DOM、随机数、当前时间。
- 相同输入必须得到逐位相同的输出，便于复核与测试。
- `SafetyResult.steps`、`DeadlockResult.steps` 必须逐步可展示，不能只返回最终布尔值。

## 3. SystemState 示例

```json
{
  "id": "unsafe_01",
  "resources": ["A", "B", "C"],
  "total": [2, 2, 2],
  "available": [1, 1, 1],
  "processes": ["P0", "P1", "P2"],
  "allocation": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  "max": [[3, 1, 0], [0, 3, 0], [0, 0, 3]],
  "requests": [[1, 1, 0], [0, 1, 0], [0, 0, 1]]
}
```

## 4. 案例 JSON 结构

```json
{
  "id": "safe_01",
  "title": "安全状态：存在完整安全序列",
  "kind": "safe | unsafe | deadlock",
  "summary": "一句话说明这个案例要证明什么",
  "state": { "…": "SystemState" },
  "expected": {
    "safe": true,
    "deadlocked": false,
    "safeSequence": ["P1", "P3", "P0", "P2"],
    "reducibleOrder": ["P0", "P1", "P2"],
    "stuck": [],
    "waitEdges": [{ "from": "P0", "to": "P1", "resource": "B" }]
  }
}
```

`expected` 只用于测试与评审核对，不参与运行时计算；页面必须标注「设计预期，以程序结果为准」。

## 5. TraceEvent

```ts
{
  index: number;
  kind: "VALIDATE" | "TRIAL_ALLOCATE" | "SAFETY_SCAN" | "ROLLBACK" | "COMMIT" | "RELEASE" | "REDUCE";
  message: string;
  process?: string;
  resource?: string;
  available?: number[];
}
```

要求：

- `index` 从 0 连续递增。
- 每条事件都能对应到 `docs/model.md` 的一个判定步骤。
- 导出原始轨迹时按 `index` 排序，不依赖控制台输出。

## 6. 错误与拒绝

| 场景 | 处理 |
|---|---|
| 维度不符、负数、非整数、进程不存在 | `ILLEGAL_INPUT`，状态不变 |
| 请求 > need | `EXCEEDS_NEED`，状态不变 |
| 请求 > available | `EXCEEDS_AVAILABLE`，状态不变 |
| 试分配后无安全序列 | `UNSAFE_AFTER_TRIAL`，回滚，状态不变 |
| 释放 > allocation 或为负 | 拒绝，状态不变 |

## 7. 测试门槛（合并前必须全绿）

1. `safe_01` 返回 `safe=true`，序列为 `P1 → P3 → P0 → P2`。
2. `unsafe_01` 返回 `safe=false`，且 `deadlocked=false`。
3. `deadlock_01` 返回 `deadlocked=true`，`stuck=[P0,P1,P2]`。
4. 三类拒绝原因各自命中一次，且 `after` 与 `before` 深相等。
5. 每类资源守恒：`available + Σallocation = total`。
6. 释放超过持有量被拒绝，状态不变。
7. 释放后自动复检安全性，结果随状态变化。
8. 安全序列每一步 `work` 单调不减，最终等于 `total`。

## 8. 变更流程

- 类型只加可选字段，不改已有字段语义；破坏性改动需全组同意并同步更新本文档。
- 案例 JSON 改动必须同时更新 `expected`，并在 PR 描述里写明理由。
- 合并前至少 2 人 review，其中 1 人不是该模块作者。
