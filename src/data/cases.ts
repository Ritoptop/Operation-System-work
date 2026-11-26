import type { LabCase } from "../core/types";
import safe01 from "../../cases/safe_01.json";
import unsafe01 from "../../cases/unsafe_01.json";
import deadlock01 from "../../cases/deadlock_01.json";

/**
 * 案例唯一入口。页面、单测、复核脚本都从这里取数，
 * JSON 中的 kind 是字符串字面量，需经 unknown 收敛到联合类型。
 */
export const CASES: LabCase[] = [
  safe01,
  unsafe01,
  deadlock01,
] as unknown as LabCase[];
