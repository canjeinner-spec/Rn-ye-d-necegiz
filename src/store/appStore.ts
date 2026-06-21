import { type Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { type DMThread } from "@/data/dm";
import { type Room } from "@/data/seed";
import { getSession, onAuthChange, signOut } from "@/data/remote/authRepo";
import { ensureMyProfile, getMyProfile } from "@/data/remote/profileRepo";
import { isSupabaseConfigured } from "@/lib/supabase";

export type BroadcastData = {
  sender: string;
  recipient?: string;
  qty: number;
  room: Room;
  gift: { tier: "normal" | "rare" | "epic" | "legendary"; emoji: string; name: string };
};

export type UserRole = "user" | "developer" | "super_admin";

/** Supabase ekonomi_rolu → uygulama UserRole eşlemesi. */
function mapRole(ekonomiRolu?: string | null): UserRole {
  if (ekonomiRolu === "super_admin" || ekonomiRolu === "developer") return ekonomiRolu;
  return "user";
}

type AppState = {
  girisYapildi: boolean;
  setGirisYapildi: (v: boolean) => void;

  // Supabase oturumu
  session: Session | null;
  bootstrapped: boolean;
  publicId: string | null;
  initAuth: () => void;
  loadProfile: () => Promise<void>;
  signOutApp: () => Promise<void>;

  userName: string;
  userBio: string;
  userPhoto: string | null;
  isStreamer: boolean;
  role: UserRole;
  hideProfile: boolean;
  setRole: (r: UserRole) => void;
  setHideProfile: (v: boolean) => void;
  myRoom: Room | null;
  currentRoom: Room | null;
  inRoom: boolean;
  broadcast: BroadcastData | null;
  activeDM: DMThread | null;
  setActiveDM: (d: DMThread | null) => void;

  roomName: string;
  roomAnnounce: string;
  roomLocked: boolean;
  roomPass: string;
  setRoomName: (v: string) => void;
  setRoomAnnounce: (v: string) => void;
  setRoomLocked: (v: boolean) => void;
  setRoomPass: (v: string) => void;

  setUserName: (n: string) => void;
  setUserBio: (b: string) => void;
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
let authStarted = false;

export const useApp = create<AppState>((set, get) => ({
  girisYapildi: false,
  setGirisYapildi: (v) => set({ girisYapildi: v }),

  session: null,
  bootstrapped: false,
  publicId: null,

  initAuth: () => {
    if (authStarted) return;
    authStarted = true;
    // Supabase yapılandırılmadıysa (env yoksa) mock akışla devam et.
    if (!isSupabaseConfigured) {
      set({ bootstrapped: true });
      return;
    }
    getSession()
      .then(async (session) => {
        set({ session, girisYapildi: !!session });
        if (session) await get().loadProfile();
      })
      .catch(() => {})
      .finally(() => set({ bootstrapped: true }));

    onAuthChange(async (session) => {
      set({ session, girisYapildi: !!session });
      if (session) await get().loadProfile();
    });
  },

  loadProfile: async () => {
    try {
      let p = await getMyProfile();
      // Satır yoksa: trigger henüz işlememiş olabilir ya da satır elle
      // silinmiş olabilir → self-heal RPC ile garantile, sonra tekrar oku.
      if (!p) {
        try {
          await ensureMyProfile();
        } catch {
          await new Promise((r) => setTimeout(r, 800)); // RPC yoksa kısa bekleyip yine dene
        }
        p = await getMyProfile();
      }
      if (!p) return;
      set({
        userName: p.kullanici_adi || get().userName,
        userBio: p.biyografi || "",
        userPhoto: p.profil_resmi || null,
        publicId: p.public_id || null,
        role: mapRole(p.ekonomi_rolu),
      });
    } catch {
      // sessizce geç — oturum geçerli, profil sonradan yüklenebilir
    }
  },

  signOutApp: async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    set({
      session: null,
      girisYapildi: false,
      publicId: null,
      userName: "Sen",
      userBio: "",
      userPhoto: null,
      role: "user",
    });
  },

  userName: "Sen",
  userBio: "",
  userPhoto: null,
  isStreamer: false,
  role: "user",
  hideProfile: false,
  setRole: (r) => set({ role: r }),
  setHideProfile: (v) => set({ hideProfile: v }),
  myRoom: null,
  currentRoom: null,
  inRoom: false,
  broadcast: null,
  activeDM: null,
  setActiveDM: (d) => set({ activeDM: d }),

  roomName: "",
  roomAnnounce: "",
  roomLocked: false,
  roomPass: "",
  setRoomName: (v) => set({ roomName: v }),
  setRoomAnnounce: (v) => set({ roomAnnounce: v }),
  setRoomLocked: (v) => set({ roomLocked: v }),
  setRoomPass: (v) => set({ roomPass: v }),

  setUserName: (n) => set({ userName: n }),
  setUserBio: (b) => set({ userBio: b }),
  setUserPhoto: (p) => set({ userPhoto: p }),
  setStreamer: (v) => set({ isStreamer: v }),

  enterRoom: (r) =>
    set({
      currentRoom: r,
      inRoom: true,
      roomName: r.name,
      roomAnnounce: r.official ? "Resmî odaya hoş geldiniz! Lütfen nazik olun, keyifli sohbetler dileriz." : "Herkes davetli, saygıyı koru 🌙",
      roomLocked: !!r.locked,
      roomPass: r.pass || "",
    }),
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
