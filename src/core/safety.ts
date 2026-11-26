import { deriveNeed } from "./validate";
import type { SafetyResult, SafetyStep, SystemState } from "./types";

function leq(left: number[], right: number[]): boolean {
  return left.every((value, j) => value <= right[j]);
}

function describeStop(state: SystemState, need: number[][], work: number[], unfinished: number[]): string {
  const details = unfinished
    .map((i) => `${state.processes[i]} 尚需 [${need[i].join(", ")}]`)
    .join("；");
  return `无进程满足 need ≤ work：work = [${work.join(", ")}]；${details}`;
}

/**
 * 安全性检查（银行家算法）。
 *
 * - work 初始化为 available 的副本
 * - 每轮按进程编号升序选择第一个 need ≤ work 的进程
 * - 进程完成后 work += allocation（不是 need，也不是 max）
 * - 无候选时 safe=false，steps 最后一帧记录停止时的 work 与原因
 */
export function checkSafety(state: SystemState): SafetyResult {
  const need = deriveNeed(state);
  const n = state.processes.length;
  const work = [...state.available];
  const finished = new Array<boolean>(n).fill(false);
  const sequence: string[] = [];
  const steps: SafetyStep[] = [];
  let stopReason: string | null = null;

  for (let round = 0; round < n; round += 1) {
    const candidates: number[] = [];
    for (let i = 0; i < n; i += 1) {
      if (!finished[i] && leq(need[i], work)) candidates.push(i);
    }

    if (candidates.length === 0) {
      const unfinished = state.processes.map((_, i) => i).filter((i) => !finished[i]);
      stopReason = describeStop(state, need, work, unfinished);
      steps.push({
        index: steps.length,
        work: [...work],
        candidates: [],
        chosen: null,
        finished: state.processes.filter((_, i) => finished[i]),
        note: stopReason,
      });
      break;
    }

    const pick = candidates[0];
    const processId = state.processes[pick];
    const workBefore = [...work];
    const needBefore = [...need[pick]];
    const allocation = [...state.allocation[pick]];

    finished[pick] = true;
    sequence.push(processId);
    work.forEach((_, j) => {
      work[j] += allocation[j];
    });

    steps.push({
      index: steps.length,
      work: workBefore,
      candidates: candidates.map((i) => state.processes[i]),
      chosen: processId,
      finished: state.processes.filter((_, i) => finished[i]),
      note: `${processId} 尚需 [${needBefore.join(", ")}] ≤ work [${workBefore.join(", ")}]，完成后 work += [${allocation.join(", ")}]`,
    });
  }

  const safe = finished.every(Boolean);
  return {
    safe,
    sequence: safe ? sequence : [],
    steps,
    stopReason: safe ? null : stopReason,
  };
}
