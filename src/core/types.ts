/**
 * 题目四：资源分配安全性与死锁状态辨析
 * 全局数据契约（v1.0，冻结候选）
 *
 * 约定：
 * - 所有向量与矩阵按 [资源类型] 排列，顺序由 state.resources 决定。
 * - allocation / max / requests 按 [进程] 排列，顺序由 state.processes 决定。
 * - need 不落库，由 max - allocation 派生，避免三处数据不一致。
 * - requests[i] === null 表示进程当前没有阻塞中的请求。
 */

export type ProcessId = string;
export type ResourceId = string;

/** 一次实验的完整系统状态。 */
export interface SystemState {
  /** 案例编号，与 cases/*.json 的 id 一致 */
  id: string;
  /** 资源类型名，如 ["A","B","C"]，1–3 个 */
  resources: ResourceId[];
  /** 每类资源的总量 */
  total: number[];
  /** 每类资源的当前可用量 */
  available: number[];
  /** 进程编号，如 ["P0","P1"]，1–4 个 */
  processes: ProcessId[];
  /** 当前分配矩阵 [进程][资源] */
  allocation: number[][];
  /** 最大需求矩阵 [进程][资源] */
  max: number[][];
  /** 当前实际等待中的请求向量；null 表示未阻塞 */
  requests: (number[] | null)[];
}

/** 三类实验状态。 */
export type CaseKind = "safe" | "unsafe" | "deadlock";

/** 案例文件结构。expected 仅用于核对与测试，不作为运行时输入。 */
export interface LabCase {
  id: string;
  title: string;
  kind: CaseKind;
  summary: string;
  state: SystemState;
  expected: {
    safe: boolean;
    deadlocked: boolean;
    safeSequence?: ProcessId[];
    reducibleOrder?: ProcessId[];
    stuck?: ProcessId[];
    waitEdges?: WaitEdge[];
  };
}

/** 安全性检查的一步：选中的进程、抉择前的 work、候选集合。 */
export interface SafetyStep {
  index: number;
  work: number[];
  candidates: ProcessId[];
  chosen: ProcessId | null;
  finished: ProcessId[];
  note: string;
}

/** 安全性检查结果。顺序即安全序列。 */
export interface SafetyResult {
  safe: boolean;
  sequence: ProcessId[];
  steps: SafetyStep[];
  stopReason: string | null;
}

/** 请求被拒绝的四种原因，必须分开显示。 */
export type RejectionCode =
  | "ILLEGAL_INPUT"
  | "EXCEEDS_NEED"
  | "EXCEEDS_AVAILABLE"
  | "UNSAFE_AFTER_TRIAL";

/** 一次请求处理的完整结果：before / trial / after 三段状态都要保留。 */
export interface RequestOutcome {
  accepted: boolean;
  code: RejectionCode | null;
  message: string;
  before: SystemState;
  trial: SystemState | null;
  after: SystemState;
  safety: SafetyResult | null;
}

/** 一次资源释放的结果。 */
export interface ReleaseOutcome {
  accepted: boolean;
  message: string;
  before: SystemState;
  after: SystemState;
  safety: SafetyResult | null;
}

/** 等待边：from 等待的资源被 to 持有。 */
export interface WaitEdge {
  from: ProcessId;
  to: ProcessId;
  resource: ResourceId;
}

/** 归约的一步：当前可用量、选中的可推进进程。 */
export interface ReductionStep {
  index: number;
  available: number[];
  runnable: ProcessId | null;
  note: string;
}

/** 实际死锁判定结果。与安全性检查相互独立。 */
export interface DeadlockResult {
  deadlocked: boolean;
  reducible: ProcessId[];
  stuck: ProcessId[];
  waitEdges: WaitEdge[];
  steps: ReductionStep[];
  reason: string;
}

/** 轨迹事件类型，供页面时间轴与证据导出复用。 */
export type TraceKind =
  | "VALIDATE"
  | "TRIAL_ALLOCATE"
  | "SAFETY_SCAN"
  | "ROLLBACK"
  | "COMMIT"
  | "RELEASE"
  | "REDUCE";

export interface TraceEvent {
  index: number;
  kind: TraceKind;
  message: string;
  process?: ProcessId;
  resource?: ResourceId;
  available?: number[];
}
