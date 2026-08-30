import { type Session } from "@supabase/supabase-js";
import { AppState as RNAppState } from "react-native";
import { create } from "zustand";

import { type DMThread } from "@/data/dm";
import { type Room } from "@/data/seed";
import { deleteAccount, getMyAccountBan, getSession, onAuthChange, signOut, type AccountBan } from "@/data/remote/authRepo";
import { evaluateBadges } from "@/data/remote/badgeRepo";
import { betaKapsulHatirlat, ensureMyProfile, getMyProfile } from "@/data/remote/profileRepo";
import { benimKusanilanlarim, BOS_KUSANILI, type Kusanili } from "@/data/remote/esyaRepo";
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
  // İlk yasak kontrolü tamamlandı mı? Oturum varken FALSE ise içerik gösterilmez
  // (opak örtü) — yasaklı kullanıcı bir an bile oda listesini görmesin diye.
  banChecked: boolean;
  enforceAccountBan: () => Promise<boolean>;
  clearHesapYasak: () => void;

  userName: string;
  userBio: string;
  userPhoto: string | null;
  userLevel: number; // gerçek seviye (kullanicilar.seviye_id)
  userXp: number; // gerçek deneyim puanı
  isStreamer: boolean;
  betaTester: boolean; // DB: kullanicilar.beta_tester → KAPSÜL hakkı
  premiumHak: boolean; // DB: kullanicilar.premium_hak → PREMIUM hakkı
  ozelId: string | null; // DB: kullanicilar.ozel_id (vitrin ID)
  ozelIdTip: "premium" | "kapsul" | null; // DB: ozel_id_tip
  ozelIdTema: string | null; // DB: ozel_id_tema (premium: banner · kapsul: kart anahtarı)
  /**
   * Kuşanılan eşyaların TEMA anahtarları (056): çerçeve, giriş efekti, balon.
   * Kendi avatarımı/mesajımı çizerken buradan okunuyor; başkalarınınki odada
   * presence yükünden, profilde kusanili_esyalar görünümünden gelir.
   */
  kusanili: Kusanili;
  /** Kuşanılanları DB'den tazele (satın alma / kuşanma sonrası). */
  kusanilanlariYenile: () => Promise<void>;
  /** DB: kullanicilar.kusanilan_rozet — profilde gösterilen rozet kodu */
  kusanilanRozet: string | null;
  setKusanilanRozet: (kod: string | null) => void;
  role: UserRole;
  hideProfile: boolean;
  setRole: (r: UserRole) => void;
  setBetaTester: (v: boolean) => void;
  setOzelIdKimlik: (id: string | null, tip: "premium" | "kapsul" | null, tema: string | null) => void;
  setHideProfile: (v: boolean) => void;
  myRoom: Room | null;
  currentRoom: Room | null;
  inRoom: boolean;
  /**
   * Odadaki koltuğum — ekran state'i DEĞİL, store'da.
   *
   * `mySeat` room.tsx'te useState'ti; ekran herhangi bir sebeple yeniden
   * kurulunca (fast refresh, üst ağaçta bir remount) null'a dönüyor ve
   * presence "koltuktan indi" diye yazılıyordu — karşı taraf seni mikrofonda
   * göremiyordu. Store'da durunca remount koltuğu düşürmüyor.
   */
  koltugum: { odaId: number; koltuk: number | null; mic: boolean } | null;
  koltukYaz: (odaId: number, koltuk: number | null, mic: boolean) => void;
  /**
   * Girilmek üzere olan oda — giriş perdesi bunun için açılır.
   *
   * Odaya girmeden ÖNCE yapılan kontroller (oda yasağı, işlem görmüş oda,
   * bağlantı) perde açıkken çalışır. Önceden önce odaya giriliyor, kontrol
   * sonra yapılıyordu; yasaklı kullanıcı odayı bir an görüp dışarı atılıyordu.
   */
  girisAdayi: Room | null;
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
  /** Yönetim ekranından düzenlenen odayı (dbId ile) store'a yansıt. */
  patchRoomByDbId: (dbId: number, p: Partial<Room>) => void;
  leaveRoom: () => void;
  /** Odaya girmeyi dene — perde açılır, kontroller geçerse odaya girilir. */
  odayaGirDene: (r: Room) => void;
  /** Perdeyi kapat, odaya girme. */
  girisIptal: () => void;
  makeMyRoom: () => Room;
  openMyRoom: () => Room;
  createMyRoom: () => Promise<Room>;

  fireBroadcast: (d: BroadcastData) => void;
  clearBroadcast: () => void;
};

let bcTimer: ReturnType<typeof setTimeout> | null = null;
let authStarted = false;
// onAuthChange aynı kullanıcı için birden çok kez tetiklenir (INITIAL_SESSION,
// TOKEN_REFRESHED…). Örtüyü yalnızca kullanıcı değişince indirmek için son
// görülen auth uid'sini tutuyoruz.
let sonAuthUid: string | null = null;

// --- Canlı hesap-yasağı izleyicisi ------------------------------------------
// Yönetici bir hesabı yasakladığı ANDA cihaz bunu görüp oturumu kapatmalı.
// İKİ katman: (1) Realtime → anında; (2) periyodik yoklama → garanti. hesap_
// yasaklari RLS'i kısıtlı olduğundan (kişi yalnız kendi satırını görür)
// Realtime teslimi her ortamda güvenilir değil; kullanıcı ön plandayken
// arka→ön geçişi de olmaz. Bu yüzden ~10sn'lik yoklama HER durumda yakalar.
let banChannel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
let watchedBanDbId: number | null = null;
let banPollTimer: ReturnType<typeof setInterval> | null = null;
const BAN_POLL_MS = 5000;
/** Yasak kontrolünün en fazla bekleyeceği süre — açılış örtüsü kilitlenmesin. */
const BAN_CHECK_TIMEOUT_MS = 5000;

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
      // Supabase açılışta INITIAL_SESSION, sonra da TOKEN_REFRESHED gibi
      // olayları AYNI kullanıcı için tekrar tekrar yayar. Her olayda
      // `banChecked`i sıfırlarsak, zaten kalkmış olan örtü tekrar iner ve
      // uygulama açılışta kilitli görünür. Bu yüzden örtüyü yalnızca
      // kullanıcı GERÇEKTEN değiştiyse (giriş/çıkış/hesap değişimi) indir.
      const uid = session?.user?.id ?? null;
      const kullaniciDegisti = uid !== sonAuthUid;
      sonAuthUid = uid;
      set({
        session,
        girisYapildi: !!session,
        ...(kullaniciDegisti ? { banChecked: !session } : null),
      });
      if (session) {
        try { supabase?.realtime.setAuth(session.access_token); } catch { /* yoksay */ }
        // Yasak kontrolü profili BEKLEMEZ: örtüyü kaldıran tek şey bu, o
        // yüzden ilk sırada ve paralel koşar. Eskiden `await loadProfile()`
        // arkasında kaldığı için soğuk açılışta örtü uzun süre kalıyordu.
        get().enforceAccountBan();
        await get().loadProfile();
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
  banChecked: false,
  clearHesapYasak: () => set({ hesapYasak: null }),
  enforceAccountBan: async () => {
    try {
      // Bu çağrı örtüyü kaldıran tek şey; askıda kalırsa uygulama açılışta
      // kilitleniyordu. Zaman aşımıyla yarıştırıyoruz — süre dolarsa "yasak
      // yok" sayılır (fail-open, hata durumundaki davranışla aynı) ve 5sn'lik
      // yoklama zaten yasağı birkaç saniye içinde yakalar.
      const t0 = Date.now();
      const ban = await Promise.race([
        getMyAccountBan(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), BAN_CHECK_TIMEOUT_MS)),
      ]);
      console.log(`[acilis] yasak kontrolu bitti (${Date.now() - t0}ms) ban=${ban ? "VAR" : "yok"}`);
      if (ban) {
        stopBanEnforcement();
        await signOut().catch(() => {});
        set({
          hesapYasak: ban,
          banChecked: true,
          session: null,
          girisYapildi: false,
          publicId: null,
          dbId: null,
          role: "user",
          profilEksik: null,
          inRoom: false,
          currentRoom: null,
          girisAdayi: null,
        });
        return true;
      }
      // Yasak yok → içerik gösterilebilir (örtü kalkar).
      set({ banChecked: true });
    } catch {
      // sessizce geç — yasak kontrolü başarısızsa kullanıcıyı kilitlemeyiz
      // (fail-open) ama örtüyü de kaldır ki uygulama açılsın.
      set({ banChecked: true });
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
        betaTester: !!p.beta_tester,
        premiumHak: !!p.premium_hak,
        ozelId: p.ozel_id ?? null,
        ozelIdTip: p.ozel_id_tip ?? null,
        ozelIdTema: p.ozel_id_tema ?? null,
        // Alan yanıtta YOKSA (kolon seçilmemiş/erişilemiyor) mevcut değeri
        // koru — aksi halde profil her tazelendiğinde kuşanılan rozet silinir.
        ...(p.kusanilan_rozet !== undefined ? { kusanilanRozet: p.kusanilan_rozet } : null),
        profilEksik: isStubName(p.kullanici_adi), // register gerekiyor mu?
      });
      // dbId belli → hesap yasağını CANLI izle (Realtime + yoklama)
      if (p.id != null) startBanEnforcement(p.id, () => get().enforceAccountBan());
      // Beta + özel ID yoksa: Sistem DM hatırlatması (sunucu idempotent — bir kez)
      if (p.beta_tester && !p.ozel_id) betaKapsulHatirlat().catch(() => {});
      // Kuralı tutan rozetleri otomatik ver (049). Sunucu idempotent — zaten
      // kazanılmışları tekrar vermez, hata olursa sessizce geçilir.
      evaluateBadges().catch(() => {});
      // Kuşanılan çerçeve/giriş/balon (056) — avatarın ve mesajlarının
      // görünümü buna bağlı, açılışta bir kez okunur.
      get().kusanilanlariYenile();
    } catch {
      // sessizce geç — oturum geçerli, profil sonradan yüklenebilir
    }
  },

  kusanilanlariYenile: async () => {
    const k = await benimKusanilanlarim().catch(() => null);
    if (k) set({ kusanili: k });
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
  premiumHak: false,
  ozelId: null,
  ozelIdTip: null,
  ozelIdTema: null,
  kusanilanRozet: null,
  role: "user",
  hideProfile: false,
  setRole: (r) => set({ role: r }),
  setHideProfile: (v) => set({ hideProfile: v }),
  myRoom: null,
  currentRoom: null,
  inRoom: false,
  koltugum: null,
  koltukYaz: (odaId, koltuk, mic) => set({ koltugum: { odaId, koltuk, mic } }),
  girisAdayi: null,
  kusanili: { ...BOS_KUSANILI },
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
  setOzelIdKimlik: (id, tip, tema) => set({ ozelId: id, ozelIdTip: tip, ozelIdTema: tema }),
  setKusanilanRozet: (kod) => set({ kusanilanRozet: kod }),

  enterRoom: (r) =>
    set({
      currentRoom: r,
      inRoom: true,
      // Perde işini bitirdi; aday temizlenir.
      girisAdayi: null,
      roomName: r.name,
      roomAnnounce: r.announce || (r.official ? "Resmî odaya hoş geldiniz! Lütfen nazik olun, keyifli sohbetler dileriz." : "Herkes davetli, saygıyı koru 🌙"),
      roomLocked: !!r.locked,
      roomPass: r.pass || "",
      kickedUsers: [],
    }),
  // Canlı ayar güncellemesi: odadayken tema/kapak/isim/duyuru değişince yansıt.
  // İçinde bulunduğum odayı günceller. Bu oda AYNI ZAMANDA kendi odamsa
  // myRoom da güncellenmeli — yoksa kapak/tema değiştirdikten sonra profildeki
  // "Odam" kartı eski hâlini göstermeye devam ediyordu.
  patchCurrentRoom: (p) =>
    set((s) => {
      const guncel = s.currentRoom ? { ...s.currentRoom, ...p } : s.currentRoom;
      const benimOdam =
        !!guncel && !!s.myRoom &&
        (s.myRoom.dbId != null ? s.myRoom.dbId === guncel.dbId : s.myRoom.id === guncel.id);
      return {
        currentRoom: guncel,
        ...(benimOdam ? { myRoom: { ...s.myRoom!, ...p } } : null),
        ...(p.name != null ? { roomName: p.name } : {}),
        ...(p.announce != null ? { roomAnnounce: p.announce } : {}),
      };
    }),
  /**
   * dbId ile oda güncelle — yönetim ekranından yapılan değişiklikler için.
   *
   * patchCurrentRoom yalnız İÇİNDE OLDUĞUM odayı güncelliyor. Yönetici bir
   * odayı düzenlediğinde o odanın içinde olmuyor; bu yüzden adı/ID'si
   * değiştikten sonra profildeki "Odam" kartı ve oda paneli eski değerleri
   * göstermeye devam ediyordu.
   */
  patchRoomByDbId: (dbId, p) =>
    set((s) => {
      const guncelMi = (r: Room | null) => !!r && r.dbId === dbId;
      const yeniCurrent = guncelMi(s.currentRoom) ? { ...s.currentRoom!, ...p } : s.currentRoom;
      return {
        currentRoom: yeniCurrent,
        ...(guncelMi(s.myRoom) ? { myRoom: { ...s.myRoom!, ...p } } : null),
        ...(guncelMi(s.currentRoom) && p.name != null ? { roomName: p.name } : {}),
        ...(guncelMi(s.currentRoom) && p.announce !== undefined ? { roomAnnounce: p.announce || "" } : {}),
      };
    }),
  leaveRoom: () => set({ inRoom: false, currentRoom: null, girisAdayi: null, koltugum: null }),
  odayaGirDene: (r) => set({ girisAdayi: r }),
  girisIptal: () => set({ girisAdayi: null }),

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
    const { myRoom, makeMyRoom, enterRoom } = get();
    // Odanın kendi kapağı varsa ona dokunma. Eskiden her açılışta
    // `photo: userPhoto || r.photo` deniyordu; kullanıcının profil fotoğrafı
    // odanın kapağını eziyor, ayarlanan oda fotoğrafı hiç görünmüyordu.
    const r = myRoom || makeMyRoom();
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
