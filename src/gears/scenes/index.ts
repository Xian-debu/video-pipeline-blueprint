import type React from "react";
import SOpen from "./open";
import SRatio from "./ratio";
import SInvolute from "./involute";
import SConjugate from "./conjugate";
import SContact from "./contact";
import STorque from "./torque";
import SPlanetary from "./planetary";
import SBacklash from "./backlash";
import SModule from "./module";
import SHistory from "./history";
import SOutro from "./outro";

/**
 * 场景表：id -> 组件。id 与 data/gears/scripts 里的 id 必须一一对应，
 * scripts/qa/scene_3d_budget.mjs 会拿它和 script.ts 对账。
 */
export const SCENE_COMPONENTS: Record<string, React.FC> = {
  open: SOpen,
  ratio: SRatio,
  involute: SInvolute,
  conjugate: SConjugate,
  contact: SContact,
  torque: STorque,
  planetary: SPlanetary,
  backlash: SBacklash,
  module: SModule,
  history: SHistory,
  outro: SOutro,
};
