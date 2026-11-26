import { useState } from "react";
import type { ChangeEvent } from "react";
import { cloneState } from "../core/state";
import { validateState } from "../core/validate";
import type { SystemState } from "../core/types";

interface StateEditorProps {
  state: SystemState;
  dirty: boolean;
  onChange: (next: SystemState) => void;
  onReset: () => void;
}

function readNumber(event: ChangeEvent<HTMLInputElement>): number {
  const value = event.target.valueAsNumber;
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function withDerivedAvailable(state: SystemState): SystemState {
  const next = cloneState(state);
  next.available = next.resources.map(
    (_, j) => next.total[j] - next.allocation.reduce((sum, row) => sum + row[j], 0),
  );
  return next;
}

function extractState(value: unknown): SystemState {
  if (typeof value !== "object" || value === null) {
    throw new Error("JSON 根节点必须是对象");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.state === "object" && record.state !== null) {
    return record.state as SystemState;
  }
  return value as SystemState;
}

export function StateEditor({ state, dirty, onChange, onReset }: StateEditorProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const allocated = state.resources.map((_, j) =>
    state.allocation.reduce((sum, row) => sum + row[j], 0),
  );

  const updateTotal = (j: number, raw: number) => {
    const next = cloneState(state);
    next.total[j] = Math.max(raw, allocated[j]);
    onChange(withDerivedAvailable(next));
  };

  const updateAllocation = (i: number, j: number, raw: number) => {
    const others = state.allocation.reduce((sum, row, k) => (k === i ? sum : sum + row[j]), 0);
    const upper = Math.max(0, Math.min(state.max[i][j], state.total[j] - others));
    const value = clamp(raw, 0, upper);
    const next = cloneState(state);
    next.allocation[i][j] = value;
    const request = next.requests[i];
    if (request) request[j] = Math.min(request[j], next.max[i][j] - value);
    onChange(withDerivedAvailable(next));
  };

  const updateMax = (i: number, j: number, raw: number) => {
    const next = cloneState(state);
    next.max[i][j] = Math.max(raw, state.allocation[i][j]);
    const request = next.requests[i];
    if (request) request[j] = Math.min(request[j], next.max[i][j] - next.allocation[i][j]);
    onChange(next);
  };

  const toggleWaiting = (i: number, checked: boolean) => {
    const next = cloneState(state);
    next.requests[i] = checked ? state.resources.map(() => 0) : null;
    onChange(next);
  };

  const updateRequest = (i: number, j: number, raw: number) => {
    const need = state.max[i][j] - state.allocation[i][j];
    const next = cloneState(state);
    const row = next.requests[i] ?? state.resources.map(() => 0);
    row[j] = clamp(raw, 0, need);
    next.requests[i] = row;
    onChange(next);
  };

  const addProcess = () => {
    if (state.processes.length >= 4) return;
    let index = 0;
    while (state.processes.includes(`P${index}`)) index += 1;
    const next = cloneState(state);
    next.processes.push(`P${index}`);
    next.allocation.push(state.resources.map(() => 0));
    next.max.push(state.resources.map(() => 0));
    next.requests.push(null);
    onChange(next);
  };

  const removeProcess = (i: number) => {
    if (state.processes.length <= 1) return;
    const next = cloneState(state);
    next.processes.splice(i, 1);
    next.allocation.splice(i, 1);
    next.max.splice(i, 1);
    next.requests.splice(i, 1);
    onChange(withDerivedAvailable(next));
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const candidate = extractState(parsed);
      if (typeof candidate.id !== "string" || candidate.id.length === 0) {
        candidate.id = "custom";
      }
      const errors = validateState(candidate);
      if (errors.length > 0) {
        setImportError(errors.join("；"));
        return;
      }
      setImportError(null);
      onChange(candidate);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "JSON 解析失败");
    }
  };

  const exportState = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.id || "state"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>状态编辑</h2>
          <p className="muted">
            修改总量、当前分配、最大需求与等待向量；可用量按守恒自动计算，改动后实时复检。
          </p>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="ghost"
            onClick={addProcess}
            disabled={state.processes.length >= 4}
          >
            添加进程
          </button>
          <label className="ghost file-label">
            导入 JSON
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
          <button type="button" className="ghost" onClick={exportState}>
            导出 JSON
          </button>
          <button type="button" className="ghost" onClick={onReset} disabled={!dirty}>
            重置
          </button>
        </div>
      </div>

      {importError && (
        <div className="banner" role="alert">
          <strong>导入失败</strong>
          <p>{importError}</p>
        </div>
      )}

      <h3 className="subhead">资源表</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>资源</th>
              <th className="num">总量</th>
              <th className="num">已分配</th>
              <th className="num">可用（派生）</th>
            </tr>
          </thead>
          <tbody>
            {state.resources.map((resource, j) => (
              <tr key={resource}>
                <th scope="row">{resource}</th>
                <td className="num">
                  <input
                    type="number"
                    min={allocated[j]}
                    step={1}
                    value={state.total[j]}
                    aria-label={`${resource} 总量`}
                    onChange={(event) => updateTotal(j, readNumber(event))}
                  />
                </td>
                <td className="mono num">{allocated[j]}</td>
                <td className="mono num">{state.available[j]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="subhead">进程表</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>进程</th>
              <th>当前分配</th>
              <th>最大需求</th>
              <th>尚需（派生）</th>
              <th>当前等待</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.processes.map((process, i) => (
              <tr key={process}>
                <th scope="row">{process}</th>
                <td>
                  <div className="cell-vector">
                    {state.resources.map((resource, j) => (
                      <input
                        key={resource}
                        type="number"
                        min={0}
                        step={1}
                        value={state.allocation[i][j]}
                        aria-label={`${process} 分配 ${resource}`}
                        onChange={(event) => updateAllocation(i, j, readNumber(event))}
                      />
                    ))}
                  </div>
                </td>
                <td>
                  <div className="cell-vector">
                    {state.resources.map((resource, j) => (
                      <input
                        key={resource}
                        type="number"
                        min={state.allocation[i][j]}
                        step={1}
                        value={state.max[i][j]}
                        aria-label={`${process} 最大需求 ${resource}`}
                        onChange={(event) => updateMax(i, j, readNumber(event))}
                      />
                    ))}
                  </div>
                </td>
                <td className="mono num">
                  [{state.max[i].map((value, j) => value - state.allocation[i][j]).join(", ")}]
                </td>
                <td>
                  <div className="wait-cell">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={state.requests[i] !== null}
                        onChange={(event) => toggleWaiting(i, event.target.checked)}
                      />
                      等待
                    </label>
                    {state.requests[i] !== null && (
                      <div className="cell-vector">
                        {state.resources.map((resource, j) => (
                          <input
                            key={resource}
                            type="number"
                            min={0}
                            step={1}
                            value={state.requests[i]?.[j] ?? 0}
                            aria-label={`${process} 等待 ${resource}`}
                            onChange={(event) => updateRequest(i, j, readNumber(event))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    className="mini-danger"
                    onClick={() => removeProcess(i)}
                    disabled={state.processes.length <= 1}
                  >
                    移除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        可用 = 总量 − 已分配；分配不得超过最大需求；等待向量不得超过尚需量。
      </p>
    </section>
  );
}
