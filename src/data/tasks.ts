import { type IconName } from "@/icons/paths";

/**
 * Görevler — gorevler (gunluk/haftalik/basarim) + gunluk_giris_odulleri.
 */
export type DailyReward = { day: number; dia: number; done: boolean; today?: boolean; big?: boolean };

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, dia: 5, done: true },
  { day: 2, dia: 10, done: true },
  { day: 3, dia: 15, done: false, today: true },
  { day: 4, dia: 20, done: false },
  { day: 5, dia: 30, done: false },
  { day: 6, dia: 50, done: false },
  { day: 7, dia: 100, done: false, big: true },
];

export type TaskItem = { ic: IconName; t: string; s: string; rew: number; prog: string; done: boolean };

export const TASKS: TaskItem[] = [
  { ic: "mic", t: "Bir odaya katıl", s: "Herhangi bir sesli odaya gir", rew: 20, prog: "1/1", done: true },
  { ic: "crown", t: "Hediye gönder", s: "Bir kullanıcıya hediye gönder", rew: 50, prog: "0/1", done: false },
  { ic: "chat", t: "10 mesaj yaz", s: "Odalarda sohbet et", rew: 15, prog: "4/10", done: false },
  { ic: "userAdd", t: "Birini takip et", s: "Yeni bir kullanıcı takip et", rew: 10, prog: "0/3", done: false },
  { ic: "bars", t: "Sıralamayı kontrol et", s: "Haftalık sıralamaya göz at", rew: 5, prog: "1/1", done: true },
];
