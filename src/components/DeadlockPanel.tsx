import type { DeadlockResult } from "../core/types";

export function DeadlockPanel({ result }: { result: DeadlockResult }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>实际死锁判定（归约）</h2>
          <p className="muted">
            只看当前请求与实际持有，不使用 max；归约停滞且仍有等待，才判定为死锁。
          </p>
        </div>
        <span className={`badge ${result.deadlocked ? "badge-deadlock" : "badge-safe"}`}>
          {result.deadlocked ? "实际死锁" : "未死锁"}
        </span>
      </div>

      <p className="result-line">{result.reason}</p>

      {result.waitEdges.length > 0 && (
        <div className="edges-block">
          <p className="note">等待边：等待者 → 持有者（括号内为资源）</p>
          <div className="chips">
            {result.waitEdges.map((edge, index) => (
              <span
                className="chip chip-deadlock"
                key={`${edge.from}-${edge.to}-${edge.resource}-${index}`}
              >
                {edge.from} → {edge.to}（{edge.resource}）
              </span>
            ))}
          </div>
        </div>
      )}

      {result.stuck.length > 0 && (
        <div className="edges-block">
          <p className="note">stuck 集合</p>
          <div className="chips">
            {result.stuck.map((processId) => (
              <span className="chip chip-deadlock" key={processId}>
                {processId}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="steps">
          <thead>
            <tr>
              <th className="num">步</th>
              <th className="num">available（推进前）</th>
              <th>推进</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {result.steps.map((step) => (
              <tr key={step.index}>
                <td className="mono num">{step.index + 1}</td>
                <td className="mono num">[{step.available.join(", ")}]</td>
                <td className="mono">{step.runnable ?? "—"}</td>
                <td className="wrap">{step.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
