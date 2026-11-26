import { useState } from "react";
import { handleRequest, releaseResources } from "../core/request";
import type {
  ProcessId,
  RejectionCode,
  ReleaseOutcome,
  RequestOutcome,
  SystemState,
} from "../core/types";

const CODE_LABEL: Record<RejectionCode, string> = {
  ILLEGAL_INPUT: "输入非法",
  EXCEEDS_NEED: "超过尚需量",
  EXCEEDS_AVAILABLE: "超过可用量",
  UNSAFE_AFTER_TRIAL: "试分配后不安全",
};

interface VectorInputProps {
  resources: string[];
  value: number[];
  onChange: (next: number[]) => void;
}

function VectorInput({ resources, value, onChange }: VectorInputProps) {
  return (
    <div className="vector-input">
      {resources.map((resource, j) => (
        <label key={resource}>
          <span>{resource}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={value[j] ?? 0}
            onChange={(event) => {
              const parsed = event.target.valueAsNumber;
              const next = [...value];
              next[j] = Number.isFinite(parsed) ? parsed : 0;
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}

function StateCompare({ processId, outcome }: { processId: ProcessId; outcome: RequestOutcome }) {
  const index = outcome.before.processes.indexOf(processId);
  if (index < 0) return null;

  const rows: Array<[string, SystemState]> = [["处理前", outcome.before]];
  if (outcome.trial) rows.push(["试分配", outcome.trial]);
  rows.push(["处理后", outcome.after]);

  return (
    <table className="compare">
      <thead>
        <tr>
          <th>阶段</th>
          <th className="num">available</th>
          <th className="num">{processId} 分配</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, snapshot]) => (
          <tr key={label}>
            <td>{label}</td>
            <td className="mono num">[{snapshot.available.join(", ")}]</td>
            <td className="mono num">[{snapshot.allocation[index].join(", ")}]</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RequestOutcomeView({ processId, outcome }: { processId: ProcessId; outcome: RequestOutcome }) {
  return (
    <div className={`outcome ${outcome.accepted ? "outcome-ok" : "outcome-reject"}`}>
      <p className="outcome-head">
        <strong>{outcome.accepted ? "已接受" : "已拒绝"}</strong>
        {outcome.code && <span className="pill">{CODE_LABEL[outcome.code]}</span>}
      </p>
      <p>{outcome.message}</p>
      <StateCompare processId={processId} outcome={outcome} />
    </div>
  );
}

function ReleaseOutcomeView({ processId, outcome }: { processId: ProcessId; outcome: ReleaseOutcome }) {
  const beforeIndex = outcome.before.processes.indexOf(processId);
  const afterIndex = outcome.after.processes.indexOf(processId);

  return (
    <div className={`outcome ${outcome.accepted ? "outcome-ok" : "outcome-reject"}`}>
      <p className="outcome-head">
        <strong>{outcome.accepted ? "已释放" : "已拒绝"}</strong>
      </p>
      <p>{outcome.message}</p>
      <p className="mono small">
        available：[{outcome.before.available.join(", ")}] → [{outcome.after.available.join(", ")}]
      </p>
      <p className="mono small">
        {processId} 分配：[
        {beforeIndex >= 0 ? outcome.before.allocation[beforeIndex].join(", ") : "—"}] → [
        {afterIndex >= 0 ? outcome.after.allocation[afterIndex].join(", ") : "—"}]
      </p>
    </div>
  );
}

interface RequestPanelProps {
  state: SystemState;
  onRequest: (processId: ProcessId, vector: number[], outcome: RequestOutcome) => void;
  onRelease: (processId: ProcessId, vector: number[], outcome: ReleaseOutcome) => void;
}

export function RequestPanel({ state, onRequest, onRelease }: RequestPanelProps) {
  const [requestProcessId, setRequestProcessId] = useState<ProcessId>(state.processes[0]);
  const [releaseProcessId, setReleaseProcessId] = useState<ProcessId>(state.processes[0]);
  const [request, setRequest] = useState<number[]>(() => state.resources.map(() => 0));
  const [release, setRelease] = useState<number[]>(() => state.resources.map(() => 0));
  const [requestResult, setRequestResult] = useState<{
    processId: ProcessId;
    outcome: RequestOutcome;
  } | null>(null);
  const [releaseResult, setReleaseResult] = useState<{
    processId: ProcessId;
    outcome: ReleaseOutcome;
  } | null>(null);

  const submitRequest = () => {
    const outcome = handleRequest(state, requestProcessId, request);
    setRequestResult({ processId: requestProcessId, outcome });
    onRequest(requestProcessId, request, outcome);
    if (outcome.accepted) {
      setRequest(state.resources.map(() => 0));
    }
  };

  const submitRelease = () => {
    const outcome = releaseResources(state, releaseProcessId, release);
    setReleaseResult({ processId: releaseProcessId, outcome });
    onRelease(releaseProcessId, release, outcome);
    if (outcome.accepted) {
      setRelease(state.resources.map(() => 0));
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>请求与释放</h2>
          <p className="muted">
            请求依次经过输入校验、尚需量检查、可用量检查、试分配与安全性检查；任何拒绝都不改变状态。
          </p>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-block">
          <h3>发起请求</h3>
          <div className="form-row">
            <label className="field">
              进程
              <select
                value={requestProcessId}
                onChange={(event) => setRequestProcessId(event.target.value)}
              >
                {state.processes.map((process) => (
                  <option key={process} value={process}>
                    {process}
                  </option>
                ))}
              </select>
            </label>
            <VectorInput resources={state.resources} value={request} onChange={setRequest} />
            <button type="button" className="primary" onClick={submitRequest}>
              提交请求
            </button>
          </div>
          {requestResult && (
            <RequestOutcomeView processId={requestResult.processId} outcome={requestResult.outcome} />
          )}
        </div>

        <div className="form-block">
          <h3>释放资源</h3>
          <div className="form-row">
            <label className="field">
              进程
              <select
                value={releaseProcessId}
                onChange={(event) => setReleaseProcessId(event.target.value)}
              >
                {state.processes.map((process) => (
                  <option key={process} value={process}>
                    {process}
                  </option>
                ))}
              </select>
            </label>
            <VectorInput resources={state.resources} value={release} onChange={setRelease} />
            <button type="button" className="primary" onClick={submitRelease}>
              释放资源
            </button>
          </div>
          {releaseResult && (
            <ReleaseOutcomeView processId={releaseResult.processId} outcome={releaseResult.outcome} />
          )}
        </div>
      </div>
    </section>
  );
}
