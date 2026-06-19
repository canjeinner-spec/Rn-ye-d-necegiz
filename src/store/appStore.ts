import { create } from "zustand";

import { type Room } from "@/data/seed";

export type BroadcastData = {
  sender: string;
  recipient?: string;
  qty: number;
  room: Room;
  gift: { tier: "normal" | "rare" | "epic" | "legendary"; emoji: string; name: string };
};

type AppState = {
  userName: string;
  userPhoto: string | null;
  isStreamer: boolean;
  myRoom: Room | null;
  currentRoom: Room | null;
  inRoom: boolean;
  broadcast: BroadcastData | null;

  setUserName: (n: string) => void;
  setUserPhoto: (p: string | null) => void;
  setStreamer: (v: boolean) => void;

  enterRoom: (r: Room) => void;
  leaveRoom: () => void;
  makeMyRoom: () => Room;
  openMyRoom: () => Room;

  fireBroadcast: (d: BroadcastData) => void;
  clearBroadcast: () => void;
};

let bcTimer: ReturnType<typeof setTimeout> | null = null;

export const useApp = create<AppState>((set, get) => ({
  userName: "Sen",
  userPhoto: null,
  isStreamer: false,
  myRoom: null,
  currentRoom: null,
  inRoom: false,
  broadcast: null,

  setUserName: (n) => set({ userName: n }),
  setUserPhoto: (p) => set({ userPhoto: p }),
  setStreamer: (v) => set({ isStreamer: v }),

  enterRoom: (r) => set({ currentRoom: r, inRoom: true }),
  leaveRoom: () => set({ inRoom: false, currentRoom: null }),

  makeMyRoom: () => {
    const { userName, userPhoto } = get();
    const r: Room = {
      id: String(Math.floor(100000 + Math.random() * 899999)),
      name: `${userName} Odası`,
      host: "Sen",
      online: 1,
      mic: 1,
      extra: 0,
      live: true,
      scene: "club",
      locked: false,
      owner: true,
      crowd: ["Sen"],
      photo: userPhoto || undefined,
    };
    set({ myRoom: r });
    return r;
  },

  openMyRoom: () => {
    const { myRoom, makeMyRoom, userPhoto, enterRoom } = get();
    let r = myRoom || makeMyRoom();
    r = { ...r, photo: userPhoto || r.photo };
    enterRoom(r);
    return r;
  },

  fireBroadcast: (d) => {
    set({ broadcast: d });
    if (bcTimer) clearTimeout(bcTimer);
    bcTimer = setTimeout(() => set({ broadcast: null }), 16500);
  },
  clearBroadcast: () => {
    if (bcTimer) clearTimeout(bcTimer);
    set({ broadcast: null });
  },
}));
