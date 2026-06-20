/**
 * ID arama dizini — backend'de gerçek lookup (kullanıcı / oda).
 */
export type SearchResult =
  | { kind: "user"; name: string; lv: number }
  | { kind: "room"; roomId: string };

export const SEARCH_DIR: Record<string, SearchResult> = {
  "4407": { kind: "user", name: "Sen", lv: 12 },
  "8821": { kind: "user", name: "Mervee", lv: 41 },
  "5023": { kind: "user", name: "Zeno Sv.", lv: 28 },
  "7710": { kind: "user", name: "Lunas", lv: 35 },
  "3398": { kind: "user", name: "Ardaowski", lv: 99 },
  "100000": { kind: "room", roomId: "100000" },
  "145632": { kind: "room", roomId: "145632" },
  "145901": { kind: "room", roomId: "145901" },
};
