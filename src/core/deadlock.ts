import type { DeadlockResult, ReductionStep, SystemState, WaitEdge } from "./types";

function isZero(vector: number[]): boolean {
  return vector.every((value) => value === 0);
}

/**
 * 实际死锁判定：只看当前请求与实际持有，不使用 max。
 *
 * 归约规则：
 * - requests[i] === null 视为无阻塞，可直接推进
 * - 否则 request ≤ available 才可推进
 * - 推进后 available -= request，进程完成并释放 allocation + request
 * - 反复直到不动点；仍有非空请求的剩余进程即为 stuck
 *
 * 注意：多实例资源下“等待图有环”只是必要条件，最终以归约是否停滞为准。
 */
export function detectDeadlock(state: SystemState): DeadlockResult {
  const n = state.processes.length;
  const zero = state.resources.map(() => 0);
  const available = [...state.available];
  const alive = new Array<boolean>(n).fill(true);
  const reducible: string[] = [];
  const steps: ReductionStep[] = [];

  let moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < n; i += 1) {
      if (!alive[i]) continue;
      const pending = state.requests[i];
      const request = pending ?? zero;
      if (!request.every((value, j) => value <= available[j])) continue;

      const availableBefore = [...available];
      request.forEach((value, j) => {
        available[j] -= value;
      });
      state.allocation[i].forEach((value, j) => {
        available[j] += value + request[j];
      });

      alive[i] = false;
      reducible.push(state.processes[i]);
      steps.push({
        index: steps.length,
        available: availableBefore,
        runnable: state.processes[i],
        note:
          pending === null
            ? `${state.processes[i]} 当前无阻塞请求，直接完成并释放 [${state.allocation[i].join(", ")}]`
            : `${state.processes[i]} 的请求 [${request.join(", ")}] ≤ available [${availableBefore.join(", ")}]，获得后完成并释放`,
      });
      moved = true;
    }
  }

  const stuck = state.processes.filter((_, i) => alive[i]);
  const deadlocked = stuck.some((processId) => {
    const i = state.processes.indexOf(processId);
    const pending = state.requests[i];
    return pending !== null && !isZero(pending);
  });

  if (stuck.length > 0) {
    steps.push({
      index: steps.length,
      available: [...available],
      runnable: null,
      note: `不动点：available = [${available.join(", ")}]，剩余进程均无法推进`,
    });
  }

  const waitEdges: WaitEdge[] = [];
  state.processes.forEach((processId, i) => {
    if (!alive[i]) return;
    const request = state.requests[i];
    if (request === null) return;
    request.forEach((amount, j) => {
      if (amount <= 0) return;
      state.processes.forEach((owner, k) => {
        if (k === i || !alive[k]) return;
        if (state.allocation[k][j] > 0) {
          waitEdges.push({
            from: processId,
            to: owner,
            resource: state.resources[j],
          });
        }
      });
    });
  });

  const reason = deadlocked
    ? `available = [${available.join(", ")}] 下无可推进进程，${stuck.join("、")} 仍处于等待，判定为实际死锁。`
    : `归约完成：${reducible.join(" → ")} 均可推进，未检测到实际死锁。`;

  return { deadlocked, reducible, stuck, waitEdges, steps, reason };
}
