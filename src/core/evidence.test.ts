import { describe, expect, it } from "vitest";
import { CASES } from "../data/cases";
import { checkSafety } from "./safety";
import { detectDeadlock } from "./deadlock";
import { buildEvidence, createRecord, toMarkdown } from "./evidence";

const first = CASES[0];

function bundleOf() {
  const record = createRecord(0, "load", "载入案例", first.state);
  return buildEvidence(
    { id: first.id, title: first.title },
    first.state,
    checkSafety(first.state),
    detectDeadlock(first.state),
    [record],
  );
}

describe("证据导出", () => {
  it("记录带可解析时间戳且快照独立", () => {
    const record = createRecord(0, "load", "载入", first.state);
    expect(Number.isNaN(Date.parse(record.at))).toBe(false);
    expect(record.state).not.toBe(first.state);
    expect(record.state.allocation).not.toBe(first.state.allocation);
  });

  it("bundle 包含当前结果与操作记录", () => {
    const bundle = bundleOf();
    expect(bundle.operations).toHaveLength(1);
    expect(bundle.safety.safe).toBe(true);
    expect(bundle.deadlock.deadlocked).toBe(false);
    expect(bundle.currentState).not.toBe(first.state);
  });

  it("Markdown 摘要包含安全序列、操作表和两张轨迹表", () => {
    const markdown = toMarkdown(bundleOf());
    expect(markdown).toContain("P1 → P3 → P0 → P2");
    expect(markdown).toContain("操作轨迹");
    expect(markdown).toContain("安全性检查轨迹");
    expect(markdown).toContain("死锁归约轨迹");
    expect(markdown).toContain("载入案例");
  });
});
