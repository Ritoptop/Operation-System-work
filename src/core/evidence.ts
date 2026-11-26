import { cloneState } from "./state";
import type { DeadlockResult, SafetyResult, SystemState } from "./types";

export type OperationKind = "load" | "edit" | "request" | "release" | "reset";

/** 一条可核对的实验操作记录，保留操作后的完整状态快照。 */
export interface OperationRecord {
  index: number;
  at: string;
  kind: OperationKind;
  summary: string;
  state: SystemState;
  processId?: string;
  vector?: number[];
  accepted?: boolean;
  code?: string | null;
  message?: string;
  trial?: SystemState | null;
}

/** 导出文件结构：当前输入、算法输出、全部操作轨迹。 */
export interface EvidenceBundle {
  tool: string;
  exportedAt: string;
  caseId: string;
  caseTitle: string;
  currentState: SystemState;
  safety: SafetyResult;
  deadlock: DeadlockResult;
  operations: OperationRecord[];
}

export function createRecord(
  index: number,
  kind: OperationKind,
  summary: string,
  state: SystemState,
  extra: Partial<Omit<OperationRecord, "index" | "at" | "kind" | "summary" | "state">> = {},
): OperationRecord {
  const record: OperationRecord = {
    index,
    at: new Date().toISOString(),
    kind,
    summary,
    state: cloneState(state),
    ...extra,
  };
  if (extra.vector) record.vector = [...extra.vector];
  if (extra.trial) record.trial = cloneState(extra.trial);
  return record;
}

export function buildEvidence(
  caseInfo: { id: string; title: string },
  currentState: SystemState,
  safety: SafetyResult,
  deadlock: DeadlockResult,
  operations: OperationRecord[],
): EvidenceBundle {
  return {
    tool: "banker-deadlock-lab v0.4",
    exportedAt: new Date().toISOString(),
    caseId: caseInfo.id,
    caseTitle: caseInfo.title,
    currentState: cloneState(currentState),
    safety,
    deadlock,
    operations,
  };
}

function cell(value: unknown): string {
  return String(value).replace(/\|/g, "\\|");
}

function vectorText(vector: number[]): string {
  return `[${vector.join(", ")}]`;
}

/** 生成可直接粘进报告的 Markdown 摘要。 */
export function toMarkdown(bundle: EvidenceBundle): string {
  const lines: string[] = [];
  lines.push(`# 证据摘要 · ${bundle.caseTitle}`);
  lines.push("");
  lines.push(`- 案例：\`${bundle.caseId}\``);
  lines.push(`- 导出时间：${bundle.exportedAt}`);
  lines.push(`- 工具：${bundle.tool}`);
  lines.push("");
  lines.push("## 当前状态");
  lines.push("");
  lines.push(`- 总量：${vectorText(bundle.currentState.total)}`);
  lines.push(`- 可用：${vectorText(bundle.currentState.available)}`);
  lines.push("");
  lines.push("| 进程 | 当前分配 | 最大需求 | 尚需 | 当前等待 |");
  lines.push("|---|---|---|---|---|");
  bundle.currentState.processes.forEach((processId, i) => {
    const need = bundle.currentState.max[i].map(
      (value, j) => value - bundle.currentState.allocation[i][j],
    );
    const request = bundle.currentState.requests[i];
    lines.push(
      `| ${processId} | ${vectorText(bundle.currentState.allocation[i])} | ${vectorText(bundle.currentState.max[i])} | ${vectorText(need)} | ${request ? vectorText(request) : "—"} |`,
    );
  });
  lines.push("");
  lines.push(`- 安全性：${bundle.safety.safe ? "安全" : "不安全"}`);
  lines.push(
    `- 安全序列：${bundle.safety.sequence.length > 0 ? bundle.safety.sequence.join(" → ") : "无"}`,
  );
  if (!bundle.safety.safe && bundle.safety.stopReason) {
    lines.push(`- 停止原因：${bundle.safety.stopReason}`);
  }
  lines.push(`- 实际死锁：${bundle.deadlock.deadlocked ? "是" : "否"}`);
  if (bundle.deadlock.stuck.length > 0) {
    lines.push(`- stuck：${bundle.deadlock.stuck.join("、")}`);
  }
  lines.push("");
  lines.push("## 操作轨迹");
  lines.push("");
  lines.push("| # | 时间 | 操作 | 结果 | 说明 |");
  lines.push("|---|---|---|---|---|");
  for (const record of bundle.operations) {
    const result =
      record.accepted === undefined
        ? "—"
        : record.accepted
          ? "接受"
          : `拒绝${record.code ? `（${record.code}）` : ""}`;
    lines.push(
      `| ${record.index} | ${record.at} | ${cell(record.kind)} | ${cell(result)} | ${cell(record.message ?? record.summary)} |`,
    );
  }
  lines.push("");
  lines.push("## 安全性检查轨迹");
  lines.push("");
  lines.push("| 步 | work（推进前） | 候选 | 选中 | 说明 |");
  lines.push("|---|---|---|---|---|");
  for (const step of bundle.safety.steps) {
    lines.push(
      `| ${step.index + 1} | ${vectorText(step.work)} | ${step.candidates.join(", ") || "—"} | ${step.chosen ?? "—"} | ${cell(step.note)} |`,
    );
  }
  lines.push("");
  lines.push("## 死锁归约轨迹");
  lines.push("");
  lines.push("| 步 | available（推进前） | 推进 | 说明 |");
  lines.push("|---|---|---|---|");
  for (const step of bundle.deadlock.steps) {
    lines.push(
      `| ${step.index + 1} | ${vectorText(step.available)} | ${step.runnable ?? "—"} | ${cell(step.note)} |`,
    );
  }
  lines.push("");
  lines.push("## 说明");
  lines.push("");
  lines.push("- 本证据来自离散模拟模型，不代表真实内核执行。");
  lines.push("- 安全性使用 max 假设；死锁判定使用当前实际请求，两者独立。");
  return lines.join("\n");
}
