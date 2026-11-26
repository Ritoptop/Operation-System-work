import { useState } from "react";
import type { OperationRecord } from "../core/evidence";

interface EvidencePanelProps {
  history: OperationRecord[];
  disabled: boolean;
  onExport: () => void;
  onCopy: () => Promise<boolean>;
}

function resultText(record: OperationRecord): string {
  if (record.accepted === undefined) return "—";
  if (record.accepted) return "接受";
  return record.code ? `拒绝 · ${record.code}` : "拒绝";
}

export function EvidencePanel({ history, disabled, onExport, onCopy }: EvidencePanelProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const copy = async () => {
    const ok = await onCopy();
    setFeedback(ok ? "已复制 Markdown 摘要到剪贴板" : "复制失败，请改用导出 JSON");
    window.setTimeout(() => setFeedback(null), 2600);
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>证据导出</h2>
          <p className="muted">
            导出内容包含当前状态、安全性检查轨迹、死锁归约轨迹与全部操作记录，可直接作为报告附件。
          </p>
        </div>
        <div className="toolbar">
          <button type="button" className="primary" onClick={onExport} disabled={disabled}>
            导出证据 JSON
          </button>
          <button type="button" className="ghost" onClick={copy} disabled={disabled}>
            复制 Markdown 摘要
          </button>
        </div>
      </div>

      {feedback && <p className="note feedback">{feedback}</p>}

      <div className="table-wrap history-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>时间</th>
              <th>操作</th>
              <th>结果</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  暂无操作记录
                </td>
              </tr>
            ) : (
              history.map((record) => (
                <tr key={`${record.index}-${record.at}`}>
                  <td className="mono num">{record.index}</td>
                  <td className="mono">
                    {new Date(record.at).toLocaleTimeString("zh-CN", { hour12: false })}
                  </td>
                  <td>{record.kind}</td>
                  <td>{resultText(record)}</td>
                  <td className="wrap">{record.message ?? record.summary}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="note">
        证据基于离散模拟模型；导出文件与页面当前状态一致，提交时请存放于 evidence/exports/。
      </p>
    </section>
  );
}
