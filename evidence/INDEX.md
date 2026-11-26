# 证据索引

> 规则：每条结论必须能指到「文件 → 页面位置 → commit」。
> 页面导出的证据 JSON 统一放在 `evidence/exports/`，命名建议 `<案例>_<日期>.json`。
> 本目录属于提交包材料。当前仓库为公开仓库，登记证据时请勿写入敏感个人信息。

## 1. 结论 → 证据

| # | 结论 | 证据文件 | 页面位置 | commit | 核对人 |
|---|---|---|---|---|---|
| C1 | 不安全不等于死锁 | `evidence/exports/unsafe_01_20261126.json` | 实际死锁面板 / 安全性面板 | 最新 commit（见 `SUBMISSION.md`） | 陈金树 |
| C2 | 安全序列可人工复算 | `evidence/exports/safe_01_20261126.json`；报告 3.2 手算表 | 安全性检查面板 | 最新 commit（见 `SUBMISSION.md`） | 黄智铭 |
| C3 | 试分配失败必须回滚 | `evidence/exports/unsafe_01_20261126.json`（`trial` 字段与拒绝记录） | 请求与释放面板 | 最新 commit（见 `SUBMISSION.md`） | 杨俊嘉 |
| C4 | 拒绝请求有三种不同原因 | `evidence/exports/deadlock_01_20261126.json`（`EXCEEDS_NEED`、`EXCEEDS_AVAILABLE`）；`unsafe_01` 导出（`UNSAFE_AFTER_TRIAL`） | 请求与释放面板 | 最新 commit（见 `SUBMISSION.md`） | 杨俊嘉 |
| C5 | 释放后需要重新检查 | `evidence/exports/deadlock_01_release_20261126.json`（`load` + `release` 两条记录） | 请求与释放 / 安全性 / 实际死锁面板 | 最新 commit（见 `SUBMISSION.md`） | 杨俊嘉 |
| C6 | 死锁必须用当前请求归约确认 | `evidence/exports/deadlock_01_20261126.json` | 实际死锁面板 | 最新 commit（见 `SUBMISSION.md`） | 黄杨荣 |

## 2. 三类案例

| 案例 | 预期 | 程序结果 | 证据文件 | 核对人 |
|---|---|---|---|---|
| `safe_01` | 安全、未死锁、序列 `P1 → P3 → P0 → P2` | 安全、未死锁，序列一致 | `evidence/exports/safe_01_20261126.json` | 黄智铭 |
| `unsafe_01` | 不安全、未死锁、归约 `P0 → P1 → P2` | 不安全、未死锁，归约顺序一致 | `evidence/exports/unsafe_01_20261126.json` | 陈金树 |
| `deadlock_01` | 不安全、死锁、stuck 为全部 | 不安全、死锁，stuck 为 `P0、P1、P2` | `evidence/exports/deadlock_01_20261126.json` | 黄杨荣 |

## 3. 手工推演

| 编号 | 内容 | 责任人 | 文件 | 与程序一致 |
|---|---|---|---|---|
| M1 | 安全序列逐步 work | 李军英 | `individual/06_李军英_独立复核与材料.md`；报告 3.2 | 是 |
| M2 | 不安全状态的停止位置 | 黄智铭 | `individual/02_黄智铭_安全性检查.md` | 是 |
| M3 | 拒绝请求的回滚 | 杨俊嘉 | `individual/03_杨俊嘉_请求与释放.md` | 是 |
| M4 | 死锁等待闭环 | 黄杨荣 | `individual/04_黄杨荣_案例与死锁.md` | 是 |

## 4. 模型交互

| 编号 | 模型/日期 | 主题 | 文件 | 关联结论 |
|---|---|---|---|---|
| L1 | DeepSeek-V4.1-Flash / 2026-11-26 | 安全性判断 | `llm/01_安全性与死锁判定.md` | C1 |
| L2 | DeepSeek-V4.1-Flash / 2026-11-26 | 拒绝原因 | `llm/02_请求处理顺序与拒绝原因.md` | C3、C4 |
| L3 | DeepSeek-V4.1-Flash / 2026-11-26 | 界面状态隔离 | `llm/03_请求释放表单状态串扰.md` | C3 |
| L4 | DeepSeek-V4.1-Flash / 2026-11-26 | 部署与环境前提 | `llm/04_部署与网络代理.md` | 交付与复现 |

## 5. 导出文件命名

- 证据 JSON：`evidence/exports/<案例>_<YYYYMMDD-HHmmss>.json`
- 人工推演：`evidence/manual/<编号>_<内容>.md` 或扫描件
- 双路径对照：`evidence/dual_path/<编号>_<说明>.json`

## 6. 待补清单

- [x] 三类案例各 1 份导出 JSON
- [x] 至少 1 份完整手算表，并与程序逐项对齐
- [x] 三条拒绝原因各 1 份记录
- [x] 释放前后复检记录
- [x] 3–5 段模型关键对话，写入 `llm/`
- [x] 6 份个人分析，写入 `individual/`
- [x] 线上 URL 与完整 commit SHA
