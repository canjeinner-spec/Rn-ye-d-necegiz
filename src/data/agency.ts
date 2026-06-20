/**
 * Yayıncı / Ajans — yayinci_odemeleri, ajanslar, ajans_uyeleri, room_statistics.
 */
export type AgencyMember = { name: string; role: "streamer"; coins: string; hours: number; active: boolean };

export const AGENCY_MEMBERS: AgencyMember[] = [
  { name: "Mervee", role: "streamer", coins: "1.8M", hours: 42, active: true },
  { name: "Lunas", role: "streamer", coins: "1.2M", hours: 38, active: true },
  { name: "Rüya", role: "streamer", coins: "940K", hours: 29, active: true },
  { name: "Ender", role: "streamer", coins: "610K", hours: 21, active: false },
  { name: "Furkan", role: "streamer", coins: "300K", hours: 12, active: true },
];

export type WeekBar = { d: string; v: number };
export const STREAMER_WEEK: WeekBar[] = [
  { d: "Pzt", v: 32 },
  { d: "Sal", v: 48 },
  { d: "Çar", v: 21 },
  { d: "Per", v: 64 },
  { d: "Cum", v: 88 },
  { d: "Cmt", v: 120 },
  { d: "Paz", v: 95 },
];
