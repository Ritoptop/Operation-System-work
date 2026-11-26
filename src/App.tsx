import { useMemo, useState } from "react";
import { CASES } from "./data/cases";
import { checkSafety } from "./core/safety";
import { detectDeadlock } from "./core/deadlock";
import { cloneState } from "./core/state";
import { validateState } from "./core/validate";
import { buildEvidence, createRecord, toMarkdown } from "./core/evidence";
import type { EvidenceBundle, OperationKind, OperationRecord } from "./core/evidence";
import type { LabCase, ProcessId, ReleaseOutcome, RequestOutcome, SystemState } from "./core/types";
import { SafetyPanel } from "./components/SafetyPanel";
import { DeadlockPanel } from "./components/DeadlockPanel";
import { RequestPanel } from "./components/RequestPanel";
import { StateEditor } from "./components/StateEditor";
import { EvidencePanel } from "./components/EvidencePanel";

const KIND_LABEL: Record<LabCase["kind"], string> = {
  safe: "安全",
  unsafe: "不安全但未死锁",
  deadlock: "实际死锁",
};

function KindBadge({ kind }: { kind: LabCase["kind"] }) {
  return <span className={`badge badge-${kind}`}>{KIND_LABEL[kind]}</span>;
}

function stamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

const FIRST_CASE = CASES[0];

export default function App() {
  const [caseId, setCaseId] = useState<string>(FIRST_CASE.id);
  const [state, setState] = useState<SystemState>(() => cloneState(FIRST_CASE.state));
  const [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState(0);
  const [history, setHistory] = useState<OperationRecord[]>(() => [
    createRecord(0, "load", `载入案例 ${FIRST_CASE.id}`, cloneState(FIRST_CASE.state)),
  ]);

  const current = CASES.find((item) => item.id === caseId) ?? FIRST_CASE;
  const errors = useMemo(() => validateState(state), [state]);
  const safety = useMemo(
    () => (errors.length === 0 ? checkSafety(state) : null),
    [state, errors.length],
  );
  const deadlock = useMemo(
    () => (errors.length === 0 ? detectDeadlock(state) : null),
    [state, errors.length],
  );

  const appendRecord = (
    kind: OperationKind,
    summary: string,
    nextState: SystemState,
    extra: Partial<Omit<OperationRecord, "index" | "at" | "kind" | "summary" | "state">> = {},
  ) => {
    setHistory((prev) => {
      const index = prev.length;
      const record = createRecord(index, kind, summary, nextState, extra);
      const last = prev[prev.length - 1];
      if (kind === "edit" && last?.kind === "edit") {
        return [...prev.slice(0, -1), { ...record, index: index - 1 }];
      }
      return [...prev, record];
    });
  };

  const loadCase = (item: LabCase) => {
    const initial = cloneState(item.state);
    setCaseId(item.id);
    setState(initial);
    setDirty(false);
    setVersion((value) => value + 1);
    setHistory([createRecord(0, "load", `载入案例 ${item.id}`, initial)]);
  };

  const resetCase = () => {
    const initial = cloneState(current.state);
    setState(initial);
    setDirty(false);
    setVersion((value) => value + 1);
    appendRecord("reset", "重置到案例初始状态", initial);
  };

  const applyEdit = (next: SystemState) => {
    setState(next);
    setDirty(true);
    appendRecord("edit", "编辑状态", next);
  };

  const handleRequestOperation = (
    processId: ProcessId,
    vector: number[],
    outcome: RequestOutcome,
  ) => {
    if (outcome.accepted) {
      setState(outcome.after);
      setDirty(true);
    }
    appendRecord(
      "request",
      `${processId} 请求 [${vector.join(", ")}]：${outcome.accepted ? "已接受" : "已拒绝"}`,
      outcome.accepted ? outcome.after : state,
      {
        processId,
        vector,
        accepted: outcome.accepted,
        code: outcome.code,
        message: outcome.message,
        trial: outcome.trial,
      },
    );
  };

  const handleReleaseOperation = (
    processId: ProcessId,
    vector: number[],
    outcome: ReleaseOutcome,
  ) => {
    if (outcome.accepted) {
      setState(outcome.after);
      setDirty(true);
    }
    appendRecord(
      "release",
      `${processId} 释放 [${vector.join(", ")}]：${outcome.accepted ? "已接受" : "已拒绝"}`,
      outcome.accepted ? outcome.after : state,
      {
        processId,
        vector,
        accepted: outcome.accepted,
        message: outcome.message,
      },
    );
  };

  const makeBundle = (): EvidenceBundle | null => {
    if (!safety || !deadlock) return null;
    return buildEvidence(current, state, safety, deadlock, history);
  };

  const exportEvidence = () => {
    const bundle = makeBundle();
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.id}_evidence_${stamp()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyEvidence = async (): Promise<boolean> => {
    const bundle = makeBundle();
    if (!bundle) return false;
    try {
      await navigator.clipboard.writeText(toMarkdown(bundle));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">操作系统原理 · 课内实践 · 题目四</p>
          <h1>资源分配安全性与死锁状态辨析</h1>
        </div>
        <p className="topbar-meta">
          离散模型 · 无抢占 · 不计开销
          <br />
          v0.4 · 证据可导出
        </p>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <h2 className="sidebar-title">实验案例</h2>
          <p className="sidebar-hint">数据源：cases/*.json</p>
          {CASES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`case-card${item.id === caseId ? " active" : ""}`}
              onClick={() => loadCase(item)}
            >
              <span className="case-id mono">{item.id}</span>
              <span className="case-title">{item.title}</span>
              <KindBadge kind={item.kind} />
            </button>
          ))}
          <div className="legend">
            <p>
              <span className="dot dot-safe" />
              安全：存在安全序列
            </p>
            <p>
              <span className="dot dot-unsafe" />
              不安全：无安全序列
            </p>
            <p>
              <span className="dot dot-deadlock" />
              死锁：无人可推进
            </p>
          </div>
        </aside>

        <main className="content">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>{current.title}</h2>
                <p className="muted">{current.summary}</p>
                <p className="note expected-line">
                  初始预期：安全性 {current.expected.safe ? "安全" : "不安全"} · 死锁{" "}
                  {current.expected.deadlocked ? "是" : "否"}
                  {current.expected.safeSequence
                    ? ` · 安全序列 ${current.expected.safeSequence.join(" → ")}`
                    : ""}
                  {current.expected.stuck?.length
                    ? ` · stuck ${current.expected.stuck.join("、")}`
                    : ""}
                </p>
              </div>
              <div className="head-badges">
                {dirty && <span className="pill pill-dirty">状态已修改</span>}
                <KindBadge kind={current.kind} />
              </div>
            </div>
            {errors.length > 0 && (
              <div className="banner" role="alert">
                <strong>状态校验未通过</strong>
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <StateEditor
            state={state}
            dirty={dirty}
            onChange={applyEdit}
            onReset={resetCase}
          />

          <RequestPanel
            key={`${caseId}-${version}`}
            state={state}
            onRequest={handleRequestOperation}
            onRelease={handleReleaseOperation}
          />

          {safety && <SafetyPanel result={safety} />}
          {deadlock && <DeadlockPanel result={deadlock} />}

          <EvidencePanel
            history={history}
            disabled={!safety || !deadlock}
            onExport={exportEvidence}
            onCopy={copyEvidence}
          />

          <footer className="footer">
            核心算法已接入：安全性检查、请求/释放、归约死锁判定；编辑状态后实时复检并记录证据。
          </footer>
        </main>
      </div>
    </div>
  );
}
