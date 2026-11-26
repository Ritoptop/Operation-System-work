/**
 * 三类案例证据导出脚本。
 *
 * 直接复用 src/core 的真实实现，避免手工拼接 JSON 与程序行为脱节。
 * 运行：npx vite-node scripts/export-evidence.ts
 * 输出：evidence/exports/<案例>_20261126.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CASES } from "../src/data/cases";
import { detectDeadlock } from "../src/core/deadlock";
import { buildEvidence, createRecord } from "../src/core/evidence";
import { handleRequest, releaseResources } from "../src/core/request";
import { checkSafety } from "../src/core/safety";
import { cloneState } from "../src/core/state";
import type { LabCase, OperationRecord } from "../src/core/types";

const STAMP = "20261126";
const OUT_DIR = join(process.cwd(), "evidence", "exports");

function buildOperations(caseData: LabCase): OperationRecord[] {
  const state = cloneState(caseData.state);
  const operations: OperationRecord[] = [
    createRecord(0, "load", `载入案例 ${caseData.id}：${caseData.title}`, state),
  ];

  if (caseData.id === "unsafe_01") {
    // 请求 [1,1,0] 满足 need 与 available，但试分配后无安全序列 → UNSAFE_AFTER_TRIAL。
    const outcome = handleRequest(state, "P0", [1, 1, 0]);
    if (outcome.code !== "UNSAFE_AFTER_TRIAL") {
      throw new Error(`unsafe_01 预期 UNSAFE_AFTER_TRIAL，实际 ${outcome.code}`);
    }
    operations.push(
      createRecord(operations.length, "request", "P0 请求 [1, 1, 0]，试分配后被回滚", outcome.after, {
        processId: "P0",
        vector: [1, 1, 0],
        accepted: outcome.accepted,
        code: outcome.code,
        message: outcome.message,
        trial: outcome.trial,
      }),
    );
  }

  if (caseData.id === "deadlock_01") {
    // 两个拒绝分别命中 EXCEEDS_NEED 与 EXCEEDS_AVAILABLE，状态均不变。
    const exceedsNeed = handleRequest(state, "P0", [0, 2, 0]);
    if (exceedsNeed.code !== "EXCEEDS_NEED") {
      throw new Error(`deadlock_01 预期 EXCEEDS_NEED，实际 ${exceedsNeed.code}`);
    }
    operations.push(
      createRecord(operations.length, "request", "P0 请求 [0, 2, 0]，超过尚需量", exceedsNeed.after, {
        processId: "P0",
        vector: [0, 2, 0],
        accepted: exceedsNeed.accepted,
        code: exceedsNeed.code,
        message: exceedsNeed.message,
        trial: exceedsNeed.trial,
      }),
    );

    const exceedsAvailable = handleRequest(state, "P0", [0, 1, 0]);
    if (exceedsAvailable.code !== "EXCEEDS_AVAILABLE") {
      throw new Error(`deadlock_01 预期 EXCEEDS_AVAILABLE，实际 ${exceedsAvailable.code}`);
    }
    operations.push(
      createRecord(
        operations.length,
        "request",
        "P0 请求 [0, 1, 0]，当前可用量不足",
        exceedsAvailable.after,
        {
          processId: "P0",
          vector: [0, 1, 0],
          accepted: exceedsAvailable.accepted,
          code: exceedsAvailable.code,
          message: exceedsAvailable.message,
          trial: exceedsAvailable.trial,
        },
      ),
    );
  }

  return operations;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const caseData of CASES) {
    const operations = buildOperations(caseData);
    const currentState = cloneState(caseData.state);
    const safety = checkSafety(currentState);
    const deadlock = detectDeadlock(currentState);
    const bundle = buildEvidence(
      { id: caseData.id, title: caseData.title },
      currentState,
      safety,
      deadlock,
      operations,
    );

    const expected = caseData.expected;
    if (safety.safe !== expected.safe || deadlock.deadlocked !== expected.deadlocked) {
      throw new Error(
        `${caseData.id} 与 expected 不一致：safe=${safety.safe}/${expected.safe}，deadlocked=${deadlock.deadlocked}/${expected.deadlocked}`,
      );
    }

    const fileName = `${caseData.id}_${STAMP}.json`;
    writeFileSync(join(OUT_DIR, fileName), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    console.log(
      `已导出 ${fileName}：safe=${safety.safe} deadlocked=${deadlock.deadlocked} operations=${operations.length}`,
    );
  }

  // C5：释放前后复检。deadlock_01 中 P0 释放 [1,0,0] 后，A 回到可用量，
  // 等待环被打破，死锁判定应由 true 变为 false，安全性也应重新计算。
  const deadlockCase = CASES.find((item) => item.id === "deadlock_01");
  if (!deadlockCase) throw new Error("缺少 deadlock_01 案例");

  const releaseState = cloneState(deadlockCase.state);
  const releaseOps: OperationRecord[] = [
    createRecord(0, "load", `载入案例 deadlock_01：${deadlockCase.title}`, releaseState),
  ];
  const releaseOutcome = releaseResources(releaseState, "P0", [1, 0, 0]);
  if (!releaseOutcome.accepted) {
    throw new Error(`deadlock_01 释放 P0 [1,0,0] 被拒绝：${releaseOutcome.message}`);
  }
  releaseOps.push(
    createRecord(releaseOps.length, "release", "P0 释放 [1, 0, 0]，打破等待环", releaseOutcome.after, {
      processId: "P0",
      vector: [1, 0, 0],
      accepted: true,
      message: releaseOutcome.message,
    }),
  );

  const releaseSafety = checkSafety(releaseOutcome.after);
  const releaseDeadlock = detectDeadlock(releaseOutcome.after);
  if (releaseDeadlock.deadlocked || !releaseSafety.safe) {
    throw new Error(
      `deadlock_01 释放后预期安全且未死锁，实际 safe=${releaseSafety.safe} deadlocked=${releaseDeadlock.deadlocked}`,
    );
  }

  const releaseBundle = buildEvidence(
    { id: `${deadlockCase.id}_release`, title: `${deadlockCase.title}（释放 P0 [1,0,0] 后复检）` },
    releaseOutcome.after,
    releaseSafety,
    releaseDeadlock,
    releaseOps,
  );
  const releaseFile = `${deadlockCase.id}_release_${STAMP}.json`;
  writeFileSync(join(OUT_DIR, releaseFile), `${JSON.stringify(releaseBundle, null, 2)}\n`, "utf8");
  console.log(
    `已导出 ${releaseFile}：safe=${releaseSafety.safe} deadlocked=${releaseDeadlock.deadlocked} operations=${releaseOps.length}`,
  );
}

main();
