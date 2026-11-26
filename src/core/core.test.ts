import { describe, expect, it } from "vitest";
import { CASES } from "../data/cases";
import { checkSafety } from "./safety";
import { handleRequest, releaseResources } from "./request";
import { detectDeadlock } from "./deadlock";
import { validateState } from "./validate";
import { cloneState } from "./state";

function stateOf(id: string) {
  const found = CASES.find((item) => item.id === id);
  if (!found) throw new Error(`案例不存在：${id}`);
  return found.state;
}

describe("案例与状态", () => {
  it.each(CASES.map((item) => [item.id, item.state] as const))("%s 通过校验", (_id, state) => {
    expect(validateState(state)).toEqual([]);
  });
});

describe("安全性检查", () => {
  it("safe_01 给出预期安全序列", () => {
    const result = checkSafety(stateOf("safe_01"));
    expect(result.safe).toBe(true);
    expect(result.sequence).toEqual(["P1", "P3", "P0", "P2"]);
    expect(result.stopReason).toBeNull();
  });

  it("unsafe_01 无安全序列，并停在第一轮", () => {
    const result = checkSafety(stateOf("unsafe_01"));
    expect(result.safe).toBe(false);
    expect(result.sequence).toEqual([]);
    expect(result.steps[result.steps.length - 1]?.chosen).toBeNull();
    expect(result.stopReason).toContain("无进程满足");
  });

  it("deadlock_01 无安全序列", () => {
    expect(checkSafety(stateOf("deadlock_01")).safe).toBe(false);
  });

  it("不修改入参", () => {
    const state = stateOf("safe_01");
    const snapshot = cloneState(state);
    checkSafety(state);
    expect(state).toEqual(snapshot);
  });
});

describe("实际死锁判定", () => {
  it("safe_01 未死锁", () => {
    const result = detectDeadlock(stateOf("safe_01"));
    expect(result.deadlocked).toBe(false);
    expect(result.reducible).toEqual(["P0", "P1", "P2", "P3"]);
    expect(result.stuck).toEqual([]);
  });

  it("unsafe_01 不安全但未死锁", () => {
    const result = detectDeadlock(stateOf("unsafe_01"));
    expect(result.deadlocked).toBe(false);
    expect(result.reducible).toEqual(["P0", "P1", "P2"]);
    expect(result.stuck).toEqual([]);
  });

  it("deadlock_01 判定死锁并给出等待边", () => {
    const result = detectDeadlock(stateOf("deadlock_01"));
    expect(result.deadlocked).toBe(true);
    expect(result.stuck).toEqual(["P0", "P1", "P2"]);
    expect(result.reducible).toEqual([]);
    expect(result.waitEdges).toEqual([
      { from: "P0", to: "P1", resource: "B" },
      { from: "P1", to: "P2", resource: "C" },
      { from: "P2", to: "P0", resource: "A" },
    ]);
  });
});

describe("请求处理", () => {
  it("超过尚需量返回 EXCEEDS_NEED", () => {
    const state = stateOf("safe_01");
    const result = handleRequest(state, "P0", [8, 0, 0]);
    expect(result.accepted).toBe(false);
    expect(result.code).toBe("EXCEEDS_NEED");
    expect(result.after).toEqual(state);
  });

  it("超过可用量返回 EXCEEDS_AVAILABLE", () => {
    const state = stateOf("safe_01");
    const result = handleRequest(state, "P0", [0, 4, 0]);
    expect(result.code).toBe("EXCEEDS_AVAILABLE");
    expect(result.trial).toBeNull();
    expect(result.after).toEqual(state);
  });

  it("试分配后不安全返回 UNSAFE_AFTER_TRIAL 并回滚", () => {
    const state = stateOf("unsafe_01");
    const result = handleRequest(state, "P0", [1, 1, 0]);
    expect(result.code).toBe("UNSAFE_AFTER_TRIAL");
    expect(result.trial?.available).toEqual([0, 0, 1]);
    expect(result.after).toEqual(state);
  });

  it("合法请求被授予并落账", () => {
    const state = stateOf("safe_01");
    const result = handleRequest(state, "P0", [1, 0, 0]);
    expect(result.accepted).toBe(true);
    expect(result.code).toBeNull();
    expect(result.after.available).toEqual([2, 3, 4]);
    expect(result.after.allocation[0]).toEqual([1, 1, 0]);
    expect(result.safety?.safe).toBe(true);
    expect(state.available).toEqual([3, 3, 4]);
  });

  it("非法输入被拒绝", () => {
    const state = stateOf("safe_01");
    expect(handleRequest(state, "P9", [0, 0, 0]).code).toBe("ILLEGAL_INPUT");
    expect(handleRequest(state, "P0", [-1, 0, 0]).code).toBe("ILLEGAL_INPUT");
    expect(handleRequest(state, "P0", [0, 0]).code).toBe("ILLEGAL_INPUT");
  });
});

describe("资源释放", () => {
  it("释放成功后可用量增加并复检安全性", () => {
    const state = stateOf("safe_01");
    const result = releaseResources(state, "P3", [1, 0, 0]);
    expect(result.accepted).toBe(true);
    expect(result.after.available).toEqual([4, 3, 4]);
    expect(result.after.allocation[3]).toEqual([1, 1, 1]);
    expect(result.safety?.safe).toBe(true);
  });

  it("释放超过持有量被拒绝且状态不变", () => {
    const state = stateOf("safe_01");
    const result = releaseResources(state, "P3", [3, 0, 0]);
    expect(result.accepted).toBe(false);
    expect(result.after).toEqual(state);
    expect(result.safety).toBeNull();
  });
});
