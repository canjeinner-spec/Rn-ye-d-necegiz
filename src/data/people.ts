import { C } from "@/theme/colors";

/**
 * Kişi → görsel kimlik (silüet renkleri + gerçek avatar foto).
 * Web mockup'taki `PEOPLE` seed'inden taşındı. İleride backend'den gelecek.
 */
export type Person = {
  bg: [string, string];
  hair: string;
  style: "short" | "long";
  acc: string;
  photo?: string;
};

export const PEOPLE: Record<string, Person> = {
  Mervee: { bg: ["#3A1230", "#150818"], hair: "#8C2A55", style: "long", acc: "#FF7AA8", photo: "https://i.pravatar.cc/150?img=49" },
  "Zeno Sv.": { bg: ["#10204A", "#0A0B1E"], hair: "#23232E", style: "short", acc: "#7FB4FF", photo: "https://i.pravatar.cc/150?img=12" },
  Lunas: { bg: ["#3C1020", "#16091C"], hair: "#A03044", style: "long", acc: "#FF8E8E", photo: "https://i.pravatar.cc/150?img=45" },
  Ender: { bg: ["#2E1B0C", "#150C06"], hair: "#3D2A1C", style: "short", acc: "#FFC98B", photo: "https://i.pravatar.cc/150?img=33" },
  Furkan: { bg: ["#0B2A2A", "#091020"], hair: "#1C1C24", style: "short", acc: "#6FE3D2", photo: "https://i.pravatar.cc/150?img=8" },
  Ardaowski: { bg: ["#241345", "#0E081E"], hair: "#17171F", style: "short", acc: "#B79CFF", photo: "https://i.pravatar.cc/150?img=14" },
  Melis: { bg: ["#33161E", "#150A12"], hair: "#4E3526", style: "long", acc: "#F2B8C6", photo: "https://i.pravatar.cc/150?img=24" },
  Rüya: { bg: ["#2A1140", "#120822"], hair: "#5E2D86", style: "long", acc: "#C99CFF", photo: "https://i.pravatar.cc/150?img=47" },
  Sen: { bg: ["#332407", "#171005"], hair: "#22180F", style: "short", acc: C.gold2 },
};
