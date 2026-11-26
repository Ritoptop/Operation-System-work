import type { SystemState } from "./types";

/** need = max - allocation，派生量，不落库。 */
export function deriveNeed(state: SystemState): number[][] {
  return state.max.map((row, i) => row.map((value, j) => value - state.allocation[i][j]));
}

export function formatVector(vector: number[] | null | undefined): string {
  if (!vector) return "—";
  return `[${vector.join(", ")}]`;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * 校验状态是否满足模型边界与不变量。
 * 返回空数组表示合法；页面与测试共用同一套校验。
 */
export function validateState(state: SystemState): string[] {
  const errors: string[] = [];
  const { resources, processes, total, available, allocation, max, requests } = state;
  const r = resources.length;
  const p = processes.length;

  if (r < 1 || r > 3) errors.push(`资源类型数应为 1–3，当前为 ${r}`);
  if (p < 1 || p > 4) errors.push(`进程数应为 1–4，当前为 ${p}`);

  const vectors: Array<[string, number[]]> = [
    ["total", total],
    ["available", available],
  ];
  for (const [name, vector] of vectors) {
    if (vector.length !== r) {
      errors.push(`${name} 长度应为 ${r}，当前为 ${vector.length}`);
      continue;
    }
    vector.forEach((value, j) => {
      if (!isNonNegativeInt(value)) errors.push(`${name}[${j}] 必须为非负整数`);
    });
  }

  if (allocation.length !== p) errors.push(`allocation 行数应为 ${p}，当前为 ${allocation.length}`);
  if (max.length !== p) errors.push(`max 行数应为 ${p}，当前为 ${max.length}`);
  if (requests.length !== p) errors.push(`requests 行数应为 ${p}，当前为 ${requests.length}`);

  for (let i = 0; i < Math.min(p, allocation.length, max.length); i += 1) {
    if (allocation[i]?.length !== r) errors.push(`allocation[${i}] 长度应为 ${r}`);
    if (max[i]?.length !== r) errors.push(`max[${i}] 长度应为 ${r}`);
  }

  if (errors.length > 0) return errors;

  for (let i = 0; i < p; i += 1) {
    for (let j = 0; j < r; j += 1) {
      if (!isNonNegativeInt(allocation[i][j])) errors.push(`allocation[${i}][${j}] 必须为非负整数`);
      if (!isNonNegativeInt(max[i][j])) errors.push(`max[${i}][${j}] 必须为非负整数`);
      if (max[i][j] < allocation[i][j]) {
        errors.push(`进程 ${processes[i]} 的 max[${resources[j]}] 小于 allocation`);
      }
    }
  }

  for (let j = 0; j < r; j += 1) {
    const allocated = allocation.reduce((sum, row) => sum + row[j], 0);
    if (available[j] + allocated !== total[j]) {
      errors.push(
        `资源 ${resources[j]} 不守恒：available(${available[j]}) + Σallocation(${allocated}) ≠ total(${total[j]})`,
      );
    }
  }

  const need = deriveNeed(state);
  requests.forEach((request, i) => {
    if (request === null) return;
    if (request.length !== r) {
      errors.push(`requests[${i}] 长度应为 ${r}`);
      return;
    }
    request.forEach((value, j) => {
      if (!isNonNegativeInt(value)) {
        errors.push(`requests[${i}][${j}] 必须为非负整数`);
      } else if (value > need[i][j]) {
        errors.push(`进程 ${processes[i]} 的请求超过尚需量 ${resources[j]}`);
      }
    });
  });

  return errors;
}
