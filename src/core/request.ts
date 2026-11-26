import { checkSafety } from "./safety";
import { cloneState } from "./state";
import { deriveNeed } from "./validate";
import type { ProcessId, ReleaseOutcome, RequestOutcome, SystemState } from "./types";

function isNonNegativeIntVector(vector: number[], length: number): boolean {
  return (
    Array.isArray(vector) &&
    vector.length === length &&
    vector.every((value) => Number.isInteger(value) && value >= 0)
  );
}

function vectorText(vector: number[]): string {
  return `[${vector.join(", ")}]`;
}

/**
 * 处理一次资源请求。
 *
 * 判定顺序（不可调换）：
 * 1. 输入校验 → ILLEGAL_INPUT
 * 2. request ≤ need → 否则 EXCEEDS_NEED
 * 3. request ≤ available → 否则 EXCEEDS_AVAILABLE
 * 4. 试分配
 * 5. 对试分配后的状态做安全性检查
 * 6. 安全则提交；不安全则回滚 → UNSAFE_AFTER_TRIAL
 *
 * 任何拒绝都不改变状态；trial 仍保留供页面做前后对比。
 * 授予成功后清除该进程的等待请求。
 */
export function handleRequest(
  state: SystemState,
  processId: ProcessId,
  request: number[],
): RequestOutcome {
  const index = state.processes.indexOf(processId);
  const before = cloneState(state);

  if (index < 0) {
    return {
      accepted: false,
      code: "ILLEGAL_INPUT",
      message: `进程 ${processId} 不存在。`,
      before,
      trial: null,
      after: cloneState(state),
      safety: null,
    };
  }

  if (!isNonNegativeIntVector(request, state.resources.length)) {
    return {
      accepted: false,
      code: "ILLEGAL_INPUT",
      message: "请求向量必须与资源类型数等长，且全为非负整数。",
      before,
      trial: null,
      after: cloneState(state),
      safety: null,
    };
  }

  const need = deriveNeed(state);

  if (request.some((value, j) => value > need[index][j])) {
    return {
      accepted: false,
      code: "EXCEEDS_NEED",
      message: `请求 ${vectorText(request)} 超过 ${processId} 的尚需量 ${vectorText(need[index])}，违反最大需求承诺。状态不变。`,
      before,
      trial: null,
      after: cloneState(state),
      safety: null,
    };
  }

  if (request.some((value, j) => value > state.available[j])) {
    return {
      accepted: false,
      code: "EXCEEDS_AVAILABLE",
      message: `当前可用量 ${vectorText(state.available)} 不足以满足 ${vectorText(request)}，${processId} 需要等待。状态不变。`,
      before,
      trial: null,
      after: cloneState(state),
      safety: null,
    };
  }

  const trial = cloneState(state);
  request.forEach((value, j) => {
    trial.available[j] -= value;
    trial.allocation[index][j] += value;
  });
  trial.requests[index] = null;

  const safety = checkSafety(trial);

  if (!safety.safe) {
    return {
      accepted: false,
      code: "UNSAFE_AFTER_TRIAL",
      message: `试分配后不存在安全序列，已回滚。拒绝原因是不安全，不代表系统已经死锁。`,
      before,
      trial,
      after: cloneState(state),
      safety,
    };
  }

  return {
    accepted: true,
    code: null,
    message: `请求已授予；试分配后安全序列为 ${safety.sequence.join(" → ")}。`,
    before,
    trial,
    after: trial,
    safety,
  };
}

/**
 * 释放已持有资源。释放后重新做安全性检查。
 * 校验 0 ≤ release ≤ allocation，失败不改变原状态。
 */
export function releaseResources(
  state: SystemState,
  processId: ProcessId,
  release: number[],
): ReleaseOutcome {
  const index = state.processes.indexOf(processId);
  const before = cloneState(state);

  if (index < 0) {
    return {
      accepted: false,
      message: `进程 ${processId} 不存在。`,
      before,
      after: cloneState(state),
      safety: null,
    };
  }

  if (!isNonNegativeIntVector(release, state.resources.length)) {
    return {
      accepted: false,
      message: "释放向量必须与资源类型数等长，且全为非负整数。",
      before,
      after: cloneState(state),
      safety: null,
    };
  }

  if (release.some((value, j) => value > state.allocation[index][j])) {
    return {
      accepted: false,
      message: `释放量 ${vectorText(release)} 超过 ${processId} 当前持有 ${vectorText(state.allocation[index])}，拒绝且状态不变。`,
      before,
      after: cloneState(state),
      safety: null,
    };
  }

  const after = cloneState(state);
  release.forEach((value, j) => {
    after.allocation[index][j] -= value;
    after.available[j] += value;
  });

  const safety = checkSafety(after);

  return {
    accepted: true,
    message: `${processId} 已释放 ${vectorText(release)}；可用量变为 ${vectorText(after.available)}，安全性检查${safety.safe ? "通过" : "未通过"}。`,
    before,
    after,
    safety,
  };
}
