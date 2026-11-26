import type { SafetyResult } from "../core/types";

export function SafetyPanel({ result }: { result: SafetyResult }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>安全性检查（max 假设）</h2>
          <p className="muted">
            work 从 available 出发，每轮取编号最小的可满足进程，完成后 work += allocation。
          </p>
        </div>
        <span className={`badge ${result.safe ? "badge-safe" : "badge-unsafe"}`}>
          {result.safe ? "安全" : "不安全"}
        </span>
      </div>

      {result.safe ? (
        <p className="result-line">
          安全序列：<span className="mono">{result.sequence.join(" → ")}</span>
        </p>
      ) : (
        <p className="result-line reject-text">{result.stopReason}</p>
      )}

      <div className="table-wrap">
        <table className="steps">
          <thead>
            <tr>
              <th className="num">步</th>
              <th className="num">work（推进前）</th>
              <th>候选</th>
              <th>选中</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {result.steps.map((step) => (
              <tr key={step.index}>
                <td className="mono num">{step.index + 1}</td>
                <td className="mono num">[{step.work.join(", ")}]</td>
                <td className="mono">{step.candidates.join(", ") || "—"}</td>
                <td className="mono">{step.chosen ?? "—"}</td>
                <td className="wrap">{step.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
