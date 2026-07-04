import { type Session } from "@supabase/supabase-js";
import { AppState as RNAppState } from "react-native";
import { create } from "zustand";

import { type DMThread } from "@/data/dm";
import { type Room } from "@/data/seed";
import { type OzelIdKart } from "@/data/specialId";
import { deleteAccount, getMyAccountBan, getSession, onAuthChange, signOut, type AccountBan } from "@/data/remote/authRepo";
import { ensureMyProfile, getMyProfile } from "@/data/remote/profileRepo";
import { createRoom, getMyRoom, listRooms } from "@/data/remote/roomsRepo";
import { listPosts } from "@/data/remote/feedRepo";
import { addXp } from "@/data/remote/xpRepo";
import { prefetch, setCached } from "@/lib/cache";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type BroadcastData = {
  sender: string;
  recipient?: string;
  qty: number;
  room: Room;
  gift: { tier: "normal" | "rare" | "epic" | "legendary"; emoji: string; name: string };
};

export type UserRole = "user" | "developer" | "super_admin";

/** Odadan atılan kişi kaydı (kim, kim tarafından, ne zaman). */
export type KickedUser = {
  name: string;
  publicId?: string;
  photo?: string | null;
  by: string; // atan kişinin adı
  at: number; // atılma zamanı (epoch ms)
};

/** Supabase ekonomi_rolu → uygulama UserRole eşlemesi. */
function mapRole(ekonomiRolu?: string | null): UserRole {
  if (ekonomiRolu === "super_admin" || ekonomiRolu === "developer") return ekonomiRolu;
  return "user";
}

/** Otomatik oluşturulan stub kullanıcı adı mı (profil henüz tamamlanmadı)? */
function isStubName(ad?: string | null): boolean {
  return /^user_\d+$/.test((ad || "").trim());
}

type AppState = {
  girisYapildi: boolean;
  setGirisYapildi: (v: boolean) => void;

  // Supabase oturumu
  session: Session | null;
  bootstrapped: boolean;
  publicId: string | null;
  dbId: number | null; // kullanicilar.id (realtime/DM eşlemeleri için)
  initAuth: () => void;
  loadProfile: () => Promise<void>;
  signOutApp: () => Promise<void>;
  deleteAccountApp: () => Promise<void>;
  // Profil yüklendi mi + stub (tamamlanmamış) mı? null = henüz bilinmiyor.
  // Root navigasyon effect'i yalnızca `false` (yüklendi & tam) olunca
  // onboarding'den (tabs)'a geçirir — yeni Google kullanıcısını register'da tutar.
  profilEksik: boolean | null;

  // Hesap (uygulama) yasağı — doluysa tam ekran engel gösterilir + oturum kapatılır
  hesapYasak: AccountBan | null;
  enforceAccountBan: () => Promise<boolean>;
  clearHesapYasak: () => void;

  userName: string;
  userBio: string;
  userPhoto: string | null;
  userLevel: number; // gerçek seviye (kullanicilar.seviye_id)
  userXp: number; // gerçek deneyim puanı
  isStreamer: boolean;
  betaTester: boolean; // demo — beta rozeti göstermek için (kalıcı DB alanı yok)
  ozelIdKart: OzelIdKart | null; // seçilen ÖZEL ID teması (demo — DB alanı sonra)
  role: UserRole;
  hideProfile: boolean;
  setRole: (r: UserRole) => void;
  setBetaTester: (v: boolean) => void;
  setOzelIdKart: (k: OzelIdKart | null) => void;
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

  // Odadan atılanlar (oda yönetiminde listelenir; listeden silinince tekrar girebilir)
  kickedUsers: KickedUser[];
  kickFromRoom: (u: Omit<KickedUser, "by" | "at">, by: string) => void;
  unkickFromRoom: (name: string) => void;

  setUserName: (n: string) => void;
  setUserBio: (b: string) => void;
  setUserPhoto: (p: string | null) => void;
  setStreamer: (v: boolean) => void;

  enterRoom: (r: Room) => void;
  patchCurrentRoom: (p: Partial<Room>) => void;
  leaveRoom: () => void;
  makeMyRoom: () => Room;
  openMyRoom: () => Room;
  createMyRoom: () => Promise<Room>;

  fireBroadcast: (d: BroadcastData) => void;
  clearBroadcast: () => void;
};

let bcTimer: ReturnType<typeof setTimeout> | null = null;
let authStarted = false;

// --- Canlı hesap-yasağı izleyicisi ------------------------------------------
// Yönetici bir hesabı yasakladığı ANDA cihaz bunu görüp oturumu kapatmalı.
// İKİ katman: (1) Realtime → anında; (2) periyodik yoklama → garanti. hesap_
// yasaklari RLS'i kısıtlı olduğundan (kişi yalnız kendi satırını görür)
// Realtime teslimi her ortamda güvenilir değil; kullanıcı ön plandayken
// arka→ön geçişi de olmaz. Bu yüzden ~10sn'lik yoklama HER durumda yakalar.
let banChannel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
let watchedBanDbId: number | null = null;
let banPollTimer: ReturnType<typeof setInterval> | null = null;
const BAN_POLL_MS = 10000;

function startBanEnforcement(dbId: number, onChange: () => void) {
  if (!supabase) return;
  // (1) Realtime — anında
  if (watchedBanDbId !== dbId) {
    if (banChannel) { supabase.removeChannel(banChannel); banChannel = null; }
    watchedBanDbId = dbId;
    banChannel = supabase
      .channel(`hesap-yasak-${dbId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hesap_yasaklari", filter: `kullanici_id=eq.${dbId}` },
        (payload) => { if (payload.eventType !== "DELETE") onChange(); },
      )
      .subscribe();
  }
  // (2) Yoklama — garanti (Realtime kaçırırsa en geç ~10sn'de yakalar)
  if (!banPollTimer) banPollTimer = setInterval(onChange, BAN_POLL_MS);
}
function stopBanEnforcement() {
  if (supabase && banChannel) supabase.removeChannel(banChannel);
  banChannel = null;
  watchedBanDbId = null;
  if (banPollTimer) { clearInterval(banPollTimer); banPollTimer = null; }
}

export const useApp = create<AppState>((set, get) => ({
  girisYapildi: false,
  setGirisYapildi: (v) => set({ girisYapildi: v }),

  session: null,
  bootstrapped: false,
  publicId: null,
  dbId: null,
  profilEksik: null,

  initAuth: () => {
    if (authStarted) return;
    authStarted = true;
    // Supabase yapılandırılmadıysa (env yoksa) mock akışla devam et.
    if (!isSupabaseConfigured) {
      set({ bootstrapped: true });
      return;
    }
    // Supabase (auth-js) ağ hatasında bazen kendi içinde süresiz retry
    // döngüsüne giriyor ve getSession() hiç sonuçlanmıyor — bu da splash
    // ekranının sonsuza kadar açık kalmasına yol açardı. Zaman aşımıyla
    // yarışa sokuyoruz: ağ ne olursa olsun uygulama birkaç saniyede açılır.
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    Promise.race([getSession(), timeout])
      .then((session) => {
        // HIZLI BOOTSTRAP: oturum belli olur olmaz uygulamayı aç (splash'ı
        // profile bağlama — Android'de sonsuz dönme buradan geliyordu). Profil,
        // yasak ve günlük XP arka planda paralel koşar; ekranlar cache'ten
        // anında dolar, arkada tazelenir.
        set({ session, girisYapildi: !!session, bootstrapped: true });
        if (session) {
          // Realtime soketine oturum token'ını ver (RLS'li tablolarda canlı olay için)
          try { supabase?.realtime.setAuth(session.access_token); } catch { /* yoksay */ }
          get().loadProfile();
          get().enforceAccountBan();
          addXp("gunluk_giris").then((g) => { if (g > 0) get().loadProfile(); });
          // Başlangıç prefetch: ilk açılan ekranlar (ana/feed) cache'ten anında dolsun.
          prefetch("rooms:list", () => listRooms(), true);
          listPosts().then(({ posts }) => setCached("feed:db", posts, true)).catch(() => {});
          // Kendi odam DB'den yeniden yüklenir — eskiden bu hiç yapılmıyordu,
          // her reload'da unutulup "Oluştur"a basınca yeni bir oda satırı
          // ekleniyordu (önceki düzenlemeler ulaşılamaz kalıyordu).
          getMyRoom().then((r) => { if (r) set({ myRoom: r }); }).catch(() => {});
        }
      })
      .catch(() => set({ bootstrapped: true }));

    onAuthChange(async (session) => {
      set({ session, girisYapildi: !!session });
      if (session) {
        try { supabase?.realtime.setAuth(session.access_token); } catch { /* yoksay */ }
        await get().loadProfile();
        await get().enforceAccountBan();
        getMyRoom().then((r) => { if (r) set({ myRoom: r }); }).catch(() => {});
      } else {
        // Çıkış / oturum düştü → profil durumu sıfırlanır (misafir).
        stopBanEnforcement();
        set({ profilEksik: null, myRoom: null });
      }
    });

    // Uygulama ön plana gelince yasağı yeniden kontrol et (Realtime kaçırırsa
    // ya da arka planda yasaklandıysa yakalar). SSR/web statik export'ta
    // AppState olmayabilir → guard.
    if (RNAppState?.addEventListener) {
      RNAppState.addEventListener("change", (s) => {
        if (s === "active" && get().session) get().enforceAccountBan();
      });
    }
  },

  hesapYasak: null,
  clearHesapYasak: () => set({ hesapYasak: null }),
  enforceAccountBan: async () => {
    try {
      const ban = await getMyAccountBan();
      if (ban) {
        stopBanEnforcement();
        await signOut().catch(() => {});
        set({
          hesapYasak: ban,
          session: null,
          girisYapildi: false,
          publicId: null,
          dbId: null,
          role: "user",
          profilEksik: null,
          inRoom: false,
          currentRoom: null,
        });
        return true;
      }
    } catch {
      // sessizce geç — yasak kontrolü başarısızsa kullanıcıyı kilitlemeyiz
    }
    return false;
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
        userLevel: p.seviye_id ?? 1,
        userXp: p.deneyim_puani ?? 0,
        publicId: p.public_id || null,
        dbId: p.id ?? null,
        role: mapRole(p.ekonomi_rolu),
        profilEksik: isStubName(p.kullanici_adi), // register gerekiyor mu?
      });
      // dbId belli → hesap yasağını CANLI izle (Realtime + yoklama)
      if (p.id != null) startBanEnforcement(p.id, () => get().enforceAccountBan());
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
      dbId: null,
      userName: "Sen",
      userBio: "",
      userPhoto: null,
      userLevel: 1,
      userXp: 0,
      role: "user",
      profilEksik: null,
      myRoom: null,
    });
  },

  deleteAccountApp: async () => {
    await deleteAccount(); // hata olursa çağıran yakalayıp UI'da gösterir
    set({
      session: null,
      girisYapildi: false,
      publicId: null,
      dbId: null,
      userName: "Sen",
      userBio: "",
      userPhoto: null,
      userLevel: 1,
      userXp: 0,
      role: "user",
      profilEksik: null,
      myRoom: null,
    });
  },

  userName: "Sen",
  userBio: "",
  userPhoto: null,
  userLevel: 1,
  userXp: 0,
  isStreamer: false,
  betaTester: false,
  ozelIdKart: null,
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

  kickedUsers: [],
  kickFromRoom: (u, by) =>
    set((s) => ({
      kickedUsers: [
        { ...u, by, at: Date.now() },
        ...s.kickedUsers.filter((k) => k.name !== u.name),
      ],
    })),
  unkickFromRoom: (name) =>
    set((s) => ({ kickedUsers: s.kickedUsers.filter((k) => k.name !== name) })),

  setUserName: (n) => set({ userName: n }),
  setUserBio: (b) => set({ userBio: b }),
  setUserPhoto: (p) => set({ userPhoto: p }),
  setStreamer: (v) => set({ isStreamer: v }),
  setBetaTester: (v) => set({ betaTester: v }),
  setOzelIdKart: (k) => set({ ozelIdKart: k }),

  enterRoom: (r) =>
    set({
      currentRoom: r,
      inRoom: true,
      roomName: r.name,
      roomAnnounce: r.announce || (r.official ? "Resmî odaya hoş geldiniz! Lütfen nazik olun, keyifli sohbetler dileriz." : "Herkes davetli, saygıyı koru 🌙"),
      roomLocked: !!r.locked,
      roomPass: r.pass || "",
      kickedUsers: [],
    }),
  // Canlı ayar güncellemesi: odadayken tema/kapak/isim/duyuru değişince yansıt.
  patchCurrentRoom: (p) =>
    set((s) => ({
      currentRoom: s.currentRoom ? { ...s.currentRoom, ...p } : s.currentRoom,
      ...(p.name != null ? { roomName: p.name } : {}),
      ...(p.announce != null ? { roomAnnounce: p.announce } : {}),
    })),
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

  // Kalıcı oda oluşturur (Supabase). Hata/oturum yoksa yerel odaya düşer.
  createMyRoom: async () => {
    const { userName, userPhoto, enterRoom, makeMyRoom } = get();
    if (isSupabaseConfigured && get().session) {
      try {
        // Önce DB'de zaten var mı kontrol et (get-or-create) — aksi halde her
        // "Oluştur" tıklaması yeni bir oda satırı ekler, öncekiler unutulurdu.
        const r = (await getMyRoom()) ?? (await createRoom({ name: `${userName} Odası`, photo: userPhoto || null }));
        set({ myRoom: r });
        enterRoom(r);
        return r;
      } catch {
        // sessizce yerel odaya düş
      }
    }
    const r = makeMyRoom();
    enterRoom({ ...r, photo: userPhoto || r.photo });
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
