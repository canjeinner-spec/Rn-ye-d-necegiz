/**
 * Özel ID — ozel_idler (tier/durum) + zenginler sıralaması.
 */
export type SpecialTier = "super" | "t1" | "t2";

export const SPECIAL_ID_DATA: Record<SpecialTier, { gold: string; ids: string[] }> = {
  super: { gold: "36M", ids: ["11111", "22222", "33333", "44444", "55555", "66666", "77777", "88888", "99999"] },
  t1: { gold: "18M", ids: ["999999", "888888", "666666", "333333"] },
  t2: { gold: "9M", ids: ["222224", "111110", "777772", "555552"] },
};

export const tierLabel = (t: SpecialTier) =>
  t === "super" ? "Süper Özel ID" : t === "t1" ? "1. Seviye Özel ID" : "2. Seviye Özel ID";

export const tierBadgeColor = (t: SpecialTier) =>
  t === "super" ? "#E8B341" : t === "t1" ? "#EF4444" : "#3B82F6";

export type ThroneEntry = { id: string; name: string };
export const THRONE_SUPER: ThroneEntry = { id: "11111", name: "Ardaowski" };
export const THRONE_T2: ThroneEntry[] = [
  { id: "333330", name: "Mervee" },
  { id: "111110", name: "Zeno Sv." },
  { id: "666665", name: "Lunas" },
  { id: "666999", name: "Ender" },
];
