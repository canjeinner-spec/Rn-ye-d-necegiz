/**
 * Para çekme — kur_oranlari + ID lookup (backend'de gerçek dizin).
 */
export const USD_TO_DIAMOND = 210;
export const SELF_FEE = 0.16;

export type DirEntry = { name: string; lv: number };
export const ID_DIRECTORY: Record<string, DirEntry> = {
  "4407": { name: "Sen", lv: 12 },
  "8821": { name: "Mervee", lv: 41 },
  "5023": { name: "Zeno Sv.", lv: 28 },
  "7710": { name: "Lunas", lv: 35 },
  "3398": { name: "Ardaowski", lv: 99 },
};
