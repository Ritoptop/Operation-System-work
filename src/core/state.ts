import type { SystemState } from "./types";

/** 深拷贝状态，保证所有核心函数都是纯函数。 */
export function cloneState(state: SystemState): SystemState {
  return {
    ...state,
    resources: [...state.resources],
    processes: [...state.processes],
    total: [...state.total],
    available: [...state.available],
    allocation: state.allocation.map((row) => [...row]),
    max: state.max.map((row) => [...row]),
    requests: state.requests.map((row) => (row === null ? null : [...row])),
  };
}
