import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { AuthorityTag } from "@/components/AuthorityTag";
import { CenterModal } from "@/components/CenterModal";
import { KeyboardAware } from "@/components/KeyboardAware";
import { BigGiftOverlay } from "@/components/BigGiftOverlay";
import { GiftFx } from "@/components/GiftFx";
import { Pill } from "@/components/Pill";
import { Portrait } from "@/components/Portrait";
import { RoomBadges } from "@/components/RoomBadges";
import { RolePill } from "@/components/RolePill";
import { Scene } from "@/components/Scene";
import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { ContributionView } from "@/sheets/ContributionView";
import { GiftSheet } from "@/sheets/GiftSheet";
import { ProfileCard, type ProfileCardUser } from "@/sheets/ProfileCard";
import { MicQueueSheet } from "@/sheets/MicQueueSheet";
import { RoomPanel } from "@/sheets/RoomPanel";
import { RoomStats } from "@/sheets/RoomStats";
import { type Gift, TIER_RING } from "@/data/gifts";
import { hediyeGonder } from "@/data/remote/hediyeRepo";
import { reportRoom } from "@/data/remote/reportRepo";
import { addXp } from "@/data/remote/xpRepo";
import { odaSahibi, type OdaSahibi, amIBannedFromRoom, banRoomUser, banRoomUserByPublicId, getMyMicBan, getRoomMembers, logRoomMovement, odaKatilimciYaz, toScene, ziyaretKaydet, type MicBan } from "@/data/remote/roomsRepo";
import { BALON_TEMALARI } from "@/data/esyaTemalari";
import { FramePreview } from "@/components/FramePreview";
import { GirisEfekti } from "@/components/GirisEfekti";
import { CHAT0, SEATS, type ChatMsg, type HediyeSatiri, type Seat } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { FEATURES } from "@/lib/features";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * Koltuk ölçüleri — WePlay'den ölçülerek çıkarıldı.
 *
 * Referans ekran görüntüsü 1290px genişliğinde (430pt @3x):
 *   • koltuk çapı 165px  = 55pt
 *   • sütun genişliği    = 430/4 = 107.5pt  (ızgara tam ekran genişliğinde,
 *                          yatay dolgu yok)
 *   • oda sahibi çapı 273px = 91pt
 *
 * Yani çap sütunun %51'i. Sabit piksel yerine bu oranı kullanıyoruz ki her
 * ekran boyutunda aynı denge korunsun:
 *   390pt ekran → koltuk 50     430pt ekran → koltuk 55
 *
 * Sahip koltuğu WePlay'de koltuğun 1.65 katı; bizde 1.5 kullanıyoruz —
 * WePlay'in aksine sahibin altında isim ve yetki etiketi de var, 1.65
 * fazla baskın duruyordu.
 */
const { width: EKRAN } = Dimensions.get("window");
const KOLTUK = Math.round((EKRAN / 4) * 0.512);
const SAHIP_KOLTUK = Math.round(KOLTUK * 1.5);

const ROOM_REPORT: { ic: IconName; t: string }[] = [
  { ic: "adult", t: "Uygunsuz / 18+ içerik" },
  { ic: "ban", t: "Nefret söylemi veya taciz" },
  { ic: "mask", t: "Sahte / yanıltıcı içerik" },
  { ic: "spam", t: "Spam veya reklam" },
  { ic: "warn", t: "Diğer" },
];

function SpeakingRing() {
  const v = useSharedValue(0.94);
  useEffect(() => {
    v.value = withRepeat(withTiming(1.24, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false);
  }, [v]);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: v.value }], opacity: 1 - (v.value - 0.94) / 0.3 }));
  return <Animated.View pointerEvents="none" style={[styles.speakRing, s]} />;
}

function SeatItem({
  seat,
  idx,
  locked,
  userPhoto,
  userName,
  privileged,
  cerceveTema,
  onPress,
}: {
  seat: Seat | null;
  idx: number;
  locked: boolean;
  userPhoto: string | null;
  userName: string;
  privileged: boolean;
  /** Koltuktaki kişinin kuşandığı çerçeve teması (056) */
  cerceveTema?: string | null;
  onPress: () => void;
}) {
  if (!seat) {
    // WePlay: dolgusuz halka + iri artı. Zemin halkanın içinden görünür,
    // koltuklar sahnede ağırlık yapmaz.
    return (
      <Pressable style={styles.seat} onPress={onPress}>
        <View style={[styles.emptySeat, { width: KOLTUK, height: KOLTUK, borderRadius: KOLTUK / 2, borderColor: locked ? C.gold + "99" : C.gold + "52" }]}>
          <Icon name={locked ? "lock" : "plus"} size={Math.round(KOLTUK * (locked ? 0.34 : 0.5))} sw={locked ? 2 : 1.8} color={locked ? C.gold : C.dim} />
        </View>
        {locked && <Txt weight="semibold" size={10} color={C.gold}>Kilitli</Txt>}
      </Pressable>
    );
  }
  const isMe = seat.name === "Sen";
  const ring = seat.host ? C.gold : seat.mod ? C.teal : seat.speaking ? C.teal : seat.ring || "rgba(255,255,255,.16)";
  return (
    <Pressable style={styles.seat} onPress={onPress}>
      <View>
        {seat.speaking && <SpeakingRing />}
        <View style={{ width: KOLTUK, height: KOLTUK }}>
          <Portrait
            name={seat.name}
            size={KOLTUK}
            muted={seat.muted}
            photo={isMe ? userPhoto || undefined : undefined}
            ring={cerceveTema ? "transparent" : ring}
            glow={!cerceveTema && (seat.speaking || seat.host || seat.mod)}
          />
          {/* Kuşanılan çerçeve koltukta da çiziliyor (056) */}
          {cerceveTema && <FramePreview id={cerceveTema} size={KOLTUK} />}
        </View>
        {locked && (
          <View style={styles.seatLock}>
            <Icon name="lock" size={10} color={C.gold} />
          </View>
        )}
      </View>
      <Txt weight="medium" size={9.5} color={isMe ? C.gold : C.text} numberOfLines={1} style={{ maxWidth: 68 }}>
        {isMe ? userName : seat.name}
      </Txt>
      {isMe && privileged && <AuthorityTag size={8} />}
    </Pressable>
  );
}

/** Odadaki canlı üye — presence yükünden (kuşanılan eşyalar + koltuk dahil). */
type LiveMember = {
  uid: number;
  name: string;
  photo?: string;
  publicId?: string;
  cerceve?: string;
  balon?: string;
  giris?: string;
  /** Oturduğu koltuk (0-7) — null ise mikrofonda değil */
  koltuk?: number | null;
  /** Mikrofonu açık mı */
  mic?: boolean;
  /** Odaya katılma anı (epoch ms) — giriş efektini bir kez oynatmak için */
  katildi?: number;
};

function ChatRow({
  m,
  userName,
  userPhoto,
  privileged,
  balonTema,
  onSelfPress,
  onTapUser,
}: {
  m: ChatMsg;
  userName: string;
  userPhoto: string | null;
  privileged: boolean;
  /** Gönderenin kuşandığı sohbet balonu teması (056) */
  balonTema?: string | null;
  onSelfPress: () => void;
  onTapUser?: (m: ChatMsg) => void;
}) {
  if (m.sys) return <SystemNotice m={m} />;
  const role = m.host ? ("host" as const) : m.mod ? ("mod" as const) : null;
  const isMe = !!m.myOwn || m.name === "Sen";
  const displayName = isMe ? userName : m.name;
  const tap = () => (isMe ? onSelfPress() : onTapUser?.(m));
  // sohbet baloncuğu — kuşanılan balon varsa onun teması, yoksa rol rengi
  const bubble = m.myOwn ? "gold" : m.host ? "host" : m.mod ? "mod" : "plain";
  const balonT = balonTema ? BALON_TEMALARI[balonTema] : null;
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start" }}>
      {/* Sohbette çerçeve YOK: 30px avatarda halka okunmuyor, satırı
          kalabalıklaştırıyordu. Çerçeve mikrofonda ve kullanıcı kartında. */}
      <Pressable onPress={tap}>
        <Portrait name={m.name} size={30} photo={isMe ? userPhoto || undefined : m.photo} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
          <Pressable onPress={tap}>
            <Txt weight="extrabold" size={11.5} color={balonT ? balonT.ad : m.host ? C.gold : m.mod ? C.teal : isMe ? C.gold2 : "rgba(255,255,255,.7)"}>
              {displayName}
            </Txt>
          </Pressable>
          {role && <RolePill type={role} />}
          {isMe && privileged && <AuthorityTag size={8} />}
        </View>
        {/* Hediye satırı: normal baloncuk yerine hediyenin kendi kapsülü.
            Animasyon birkaç saniyede geçiyordu, sohbette iz kalmıyordu. */}
        {m.hediye ? (
          <View style={[styles.hediyeSatiri, { borderColor: m.hediye.renk + "59" }]}>
            <Gradient colors={[m.hediye.renk + "24", "rgba(255,255,255,.03)"]} deg={110} style={StyleSheet.absoluteFill} />
            <View style={[styles.hediyeIkon, { borderColor: m.hediye.renk + "4D", backgroundColor: m.hediye.renk + "1A" }]}>
              <Txt size={17}>{m.hediye.emoji}</Txt>
            </View>
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Txt weight="extrabold" size={12} color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>{m.hediye.ad}</Txt>
                <Txt weight="extrabold" size={11.5} color={m.hediye.renk}>×{m.hediye.adet}</Txt>
              </View>
              <Txt weight="semibold" size={10} color={C.gold2} numberOfLines={1} style={{ marginTop: 1 }}>
                → {m.hediye.kime}
              </Txt>
            </View>
          </View>
        ) : balonT ? (
          <View style={[styles.bubble, { backgroundColor: balonT.bg, borderColor: balonT.kenar }]}>
            <Txt weight="semibold" size={12.5} color={balonT.yazi} lh={1.4}>{m.text}</Txt>
          </View>
        ) : bubble === "gold" ? (
          <Gradient colors={["#FBE08C", "#E0A93C"]} deg={130} style={[styles.bubble, { borderColor: "#FFF2C2" }]}>
            <Txt weight="semibold" size={12.5} color="#2A1D04" lh={1.4}>{m.text}</Txt>
          </Gradient>
        ) : (
          <View
            style={[
              styles.bubble,
              bubble === "host"
                ? { backgroundColor: "rgba(245,206,110,.14)", borderColor: C.gold + "55" }
                : bubble === "mod"
                  ? { backgroundColor: "rgba(94,234,212,.12)", borderColor: C.teal + "55" }
                  : { backgroundColor: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.1)" },
            ]}
          >
            <Txt size={12.5} color="#EDEBF2" lh={1.4}>{m.text}</Txt>
          </View>
        )}
      </View>
    </View>
  );
}

/** Yönetici sistem mesajı / uyarısı — canlı sohbet baloncuğu (mesaj: altın, uyarı: kırmızı). */
function SystemNotice({ m }: { m: ChatMsg }) {
  const uyari = m.sys === "uyari";
  const c = uyari ? "#FB7185" : C.gold2;
  return (
    <View style={[styles.sysNotice, { borderColor: c + "55", backgroundColor: c + "14" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: m.baslik ? 4 : 0 }}>
        <Icon name={uyari ? "flag" : "mega"} size={13} color={c} />
        <Txt weight="extrabold" size={10.5} color={c} style={{ letterSpacing: 0.5 }}>{uyari ? "RESMÎ UYARI" : "SİSTEM MESAJI"}</Txt>
        <Txt size={9} color={C.dim2} style={{ marginLeft: "auto" }}>{m.time}</Txt>
      </View>
      {!!m.baslik && <Txt weight="extrabold" size={12.5} color="#fff" style={{ marginBottom: 2 }}>{m.baslik}</Txt>}
      <Txt size={12} color="rgba(255,255,255,.85)" lh={1.45}>{m.text}</Txt>
    </View>
  );
}

/** Odaya girince görünen tek sistem mesajı — kapsül içinde. */
function SystemBanner({ roomName }: { roomName: string }) {
  return (
    <View style={styles.welcomeCapsule}>
      <View style={{ paddingTop: 2 }}><Icon name="bell" size={12} color={C.gold2} /></View>
      <Txt size={12} color="rgba(255,255,255,.72)" lh={1.45} style={{ flexShrink: 1 }}>
        <Txt weight="extrabold" size={12} color={C.gold2}>Sistem: </Txt>
        {roomName}'na hoş geldiniz. Kurallara uyalım.
      </Txt>
    </View>
  );
}

function ActionRow({ icon, color, label, onPress }: { icon: IconName; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      <Icon name={icon} size={18} color={color} />
      <Txt weight="extrabold" size={13.5} color={color} style={{ flex: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export default function RoomScreen() {
  const router = useRouter();
  const { currentRoom, userPhoto, userName, userLevel, roomName, roomAnnounce, roomLocked, role, leaveRoom, fireBroadcast, kickFromRoom, patchCurrentRoom } = useApp();
  const session = useApp((s) => s.session);
  const myDbId = useApp((s) => s.dbId);
  const myPublicId = useApp((s) => s.publicId);
  const privileged = role !== "user";
  const room = currentRoom;
  // ownerId de bakılıyor: oda listesi profil yüklenmeden önce çekilmişse
  // mapRoom `owner`ı false hesaplıyordu ve oda sahibi kendi odasında
  // ziyaretçi sanılıyordu (sahip koltuğu yerine normal koltuğa oturuyordu).
  const isMine = !!room && (room.owner === true || (room.ownerId != null && room.ownerId === myDbId) || room.host === "Sen");

  // Gerçek (DB) oda mı? → canlı sohbet + presence
  const dbId = room?.dbId;
  const isDbRoom = !!dbId && isSupabaseConfigured && !!session;

  // Oda içi rolüm: DB odada gerçek üyelikten (sahip→host, yardimci→mod);
  // mock odada eski demo davranışı (host) korunur.
  const [myRoomRole, setMyRoomRole] = useState<"host" | "mod" | "user">(isDbRoom ? "user" : "host");
  // uid -> rol. Odadaki kullanıcılar listesinde kimin sahip/yardımcı olduğunu
  // göstermek için; eskiden yalnız kendi rolüm alınıp liste atılıyordu, bu
  // yüzden canlı odada hiç kimsenin rolü görünmüyordu.
  const [roomRoles, setRoomRoles] = useState<Map<number, "host" | "mod">>(new Map());
  useEffect(() => {
    if (!isDbRoom || !dbId) return;
    let alive = true;
    getRoomMembers(dbId)
      .then(({ members, myRole }) => {
        if (!alive) return;
        setMyRoomRole(myRole === "sahip" ? "host" : myRole === "yardimci" ? "mod" : "user");
        const m = new Map<number, "host" | "mod">();
        for (const u of members) {
          if (u.rol === "sahip") m.set(u.id, "host");
          else if (u.rol === "yardimci") m.set(u.id, "mod");
        }
        setRoomRoles(m);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isDbRoom, dbId]);
  // Platform yöneticisi (developer/super_admin) oda içinde host yetkisiyle davranır.
  const MY_ROLE: "host" | "mod" | "user" = privileged ? "host" : myRoomRole;

  // Platform mic-yasağı: odaya girer/dinler ama yazamaz/mikrofona çıkamaz (028).
  const [micBan, setMicBan] = useState<MicBan | null>(null);
  const [micBanModal, setMicBanModal] = useState(false);
  useEffect(() => {
    if (!isDbRoom) return;
    let alive = true;
    getMyMicBan()
      .then((b) => { if (!alive) return; setMicBan(b); if (b) setMicBanModal(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isDbRoom]);

  // Mic yasağı CANLI (037_realtime_yasak): yönetici yasaklarsa/kaldırırsa oda
  // içindeyken anında yansısın (yeniden girmeyi beklemeden).
  useEffect(() => {
    const sb = supabase;
    if (!isDbRoom || !sb || myDbId == null) return;
    const ch = sb
      .channel(`mic-yasak-${myDbId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mic_yasaklari", filter: `kullanici_id=eq.${myDbId}` },
        () => { getMyMicBan().then((b) => { setMicBan(b); if (b) setMicBanModal(true); }).catch(() => {}); },
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [isDbRoom, myDbId]);

  // Yasaklıysam odaya giremem: bildir ve çık (022_oda_yasaklari).
  useEffect(() => {
    if (!isDbRoom || !dbId) return;
    let alive = true;
    amIBannedFromRoom(dbId)
      .then((banned) => {
        if (!alive || !banned) return;
        toast("Bu odadan yasaklandın");
        setTimeout(() => { leaveRoom(); router.back(); }, 1400);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDbRoom, dbId]);

  /**
   * Oda GERÇEK mi (DB kaydı var mı)?
   *
   * `isDbRoom` ayrıca oturum + Supabase yapılandırması istiyor; o bayrak
   * realtime için doğru ama GÖRÜNÜM için fazla kırılgan: oturum bir an null
   * olsa demo koltukları (Mervee, Zeno, Ardaowski…) gerçek odada beliriyordu.
   * Sahte veri yalnızca dbId'si olmayan odalarda kullanılmalı.
   */
  const gercekOda = dbId != null;

  // Sahibin profili odaya girerken bir kez çekilir; odadayken fotoğrafını
  // değiştirirse presence zaten anlık taşır.
  useEffect(() => {
    if (dbId == null || !isSupabaseConfigured) return;
    let alive = true;
    odaSahibi(dbId)
      .then((s) => {
        if (!alive) return;
        console.log(`[sahip] id=${s?.id} ad=${s?.ad} foto=${(s?.foto || "-").slice(0, 40)}`);
        setSahipProfil(s);
      })
      .catch((e) => console.log("[sahip] HATA", (e as Error)?.message || e));
    return () => { alive = false; };
  }, [dbId]);

  const [host, setHost] = useState<Seat | null>(() => (dbId != null ? null : SEATS.find((s) => s.host) ?? null));
  const [seats, setSeats] = useState<(Seat | null)[]>(() => {
    const arr: (Seat | null)[] = Array(8).fill(null);
    if (dbId != null) return arr; // gerçek odada mock kimse oturmaz
    SEATS.filter((s) => !s.host).forEach((s, i) => {
      if (i < 8) arr[i] = s;
    });
    return arr;
  });
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => (dbId != null ? [] : CHAT0));
  const [liveMembers, setLiveMembers] = useState<LiveMember[]>([]);
  /** Kendi kuşandıklarım (056) — kendi mesajım ve giriş efektim için. */
  const kusanili = useApp((s) => s.kusanili);

  // Kendi giriş efektim: odaya her girişte bir kez oynar.
  //
  // Önceden presence SUBSCRIBED dalında tetikleniyordu; presence yalnızca
  // GERÇEK (DB) odalarda kuruluyor, demo odalarda hiç çalışmıyordu — bu
  // yüzden efekt "bazen" oynuyor gibi görünüyordu. Artık odanın türünden
  // bağımsız: ekran açılır açılmaz kuşandığın efekt oynar.
  useEffect(() => {
    const g = useApp.getState().kusanili.giris;
    if (!g) return;
    setGirisKuyrugu((q) => [...q, { anahtar: `ben-${Date.now()}`, uid: useApp.getState().dbId ?? undefined, ad: useApp.getState().userName, tema: g }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Sırayla oynayacak giriş bildirimleri (aynı anda tek hap). tema null → sade. */
  const [girisKuyrugu, setGirisKuyrugu] = useState<{ anahtar: string; uid?: number; ad: string; tema: string | null }[]>([]);
  /** Bir önceki sync'te odada olanlar — kimin YENİ girdiğini bundan çıkarıyoruz. */
  const girenlerRef = useRef<Set<number> | null>(null);
  /** DB'ye en son yazdığımız kişi sayısı — aynı sayıyı tekrar yazmayalım. */
  const sayacRef = useRef<number | null>(null);
  /** Girişi duyurulmuş uid'ler — aynı kişi iki kez duyurulmasın. */
  const duyurulanlarRef = useRef<Set<number>>(new Set());
  /** Bu ekranın odaya katılma anı — presence yükünde taşınır. */
  const katildiRef = useRef<number>(Date.now());
  /** Oda sahibinin güncel profili (DB'den) — host koltuğunun kaynağı. */
  const [sahipProfil, setSahipProfil] = useState<OdaSahibi | null>(null);
  const [micQueue, setMicQueue] = useState<{ uid: number; name: string; photo?: string; publicId?: string; at: number }[]>([]);
  const sitFirstEmptyRef = useRef<() => void>(() => {});
  const memberMapRef = useRef<Map<number, { name: string; photo?: string; publicId?: string }>>(new Map());
  const chanRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const chatRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const [speakerOn, setSpeakerOn] = useState(true);
  const [micOn, setMicOn] = useState(isMine);
  const [seatLocks, setSeatLocks] = useState<boolean[]>(() => Array(8).fill(false));
  const [mySeat, setMySeat] = useState<number | null>(null);
  const [seatSheet, setSeatSheet] = useState<number | null>(null);
  const [seatToast, setSeatToast] = useState("");
  const [exitModal, setExitModal] = useState(false);
  const [userList, setUserList] = useState(false);
  const [cardUser, setCardUser] = useState<ProfileCardUser | null>(null);
  const [contribOpen, setContribOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState("");
  const [reportDone, setReportDone] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftFx, setGiftFx] = useState<(Gift & { qty: number }) | null>(null);
  const [bigGift, setBigGift] = useState<{ gift: Gift; qty: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  // Giriş perdesi ARTIK BU EKRANDA DEĞİL: odaya girmeden önce, çıkılan
  // ekranın üstünde gösteriliyor (components/RoomEntryGate + AppOverlays).
  // Buraya gelindiğinde kontroller çoktan geçmiş demektir; oda doğrudan
  // açılır — küçültüp geri dönerken de perde görünmez.
  // currentRoom'a bağlı (donuk değil) → sahip kapak/tema değiştirince canlı yansır.
  const roomPhoto = room?.photo ?? null;
  const [stub, setStub] = useState<string | null>(null);

  const sendGift = async (g: Gift, qty: number, recipient: string, aliciId?: number, hediyeDbId?: number) => {
    setGiftOpen(false);

    // GERÇEK gönderim (059): altın düşer, alıcının kazancı yazılır, komisyon
    // platform havuzuna gider — hepsi DB trigger'ında. Katalog kimliği (dbId)
    // yoksa ya da demo odadaysak eskisi gibi yalnızca gösteri oynar.
    if (isDbRoom && aliciId != null && hediyeDbId) {
      try {
        await hediyeGonder(hediyeDbId, qty, aliciId, dbId ?? null);
      } catch (e) {
        haptic.warning();
        toast((e as Error)?.message || "Hediye gönderilemedi");
        return;
      }
    }

    g.tier === "legendary" ? haptic.heavy() : haptic.success();

    // Hediye sohbete de düşer: animasyon birkaç saniyede kayboluyor, kimin
    // kime ne gönderdiği kayıt olarak kalmıyordu.
    const hediye = { emoji: g.emoji, ad: g.name, adet: qty, kime: recipient, renk: TIER_RING[g.tier] || C.gold };
    const saat = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    setMsgs((m) => [...m, { name: "Sen", time: saat, text: "", myOwn: true, uid: myDbId ?? undefined, hediye }]);
    if (isDbRoom && chanRef.current) {
      chanRef.current.send({
        type: "broadcast",
        event: "chat",
        payload: { uid: myDbId, name: userName, photo: userPhoto || undefined, publicId: myPublicId || undefined, text: "", time: saat, hediye },
      });
    }

    if (g.tier === "legendary") {
      setBigGift({ gift: g, qty });
      if (room) fireBroadcast({ sender: "Sen", recipient, qty, room, gift: g });
      return;
    }
    setGiftFx({ ...g, qty });
    const dur = g.tier === "epic" ? 3000 : 2400;
    setTimeout(() => setGiftFx(null), dur);
  };

  /**
   * Gerçek odada koltuklar presence'tan türetilir — herkes aynı tabloyu görür.
   * Demo odada eski yerel state (SEATS sabiti) kullanılmaya devam eder.
   */
  const canliKoltuklar = useMemo<(Seat | null)[]>(() => {
    const arr: (Seat | null)[] = Array(8).fill(null);
    for (const m of liveMembers) {
      const k = m.koltuk;
      if (k == null || k < 0 || k > 7) continue;
      const benMi = m.uid === myDbId;
      arr[k] = {
        name: benMi ? "Sen" : m.name,
        muted: m.mic === false,
        lv: 0,
        photo: benMi ? userPhoto || undefined : m.photo,
        publicId: benMi ? myPublicId || undefined : m.publicId,
      };
    }

    // Kendi koltuğumu presence turunu beklemeden yerleştir. Oturunca "mikrofona
    // geçtin" diyor ama koltuk boş kalıyordu: presence yükünün gidip geri
    // gelmesini bekliyorduk, gecikirse ya da track sessizce düşerse hiç
    // görünmüyordu. Karşı taraf yine presence'tan görüyor.
    if (!isMine && mySeat != null && mySeat >= 0 && mySeat < 8) {
      arr[mySeat] = {
        name: "Sen",
        muted: !micOn,
        lv: userLevel,
        photo: userPhoto || undefined,
        publicId: myPublicId || undefined,
      };
    }
    return arr;
  }, [liveMembers, myDbId, userPhoto, myPublicId, isMine, mySeat, micOn, userLevel]);

  const gosterilenKoltuklar = gercekOda ? canliKoltuklar : seats;

  /**
   * Sahip koltuğu. Eskiden mock SEATS'ten geliyordu — bu yüzden HER odada
   * sahip olarak "Ardaowski" görünüyordu. Gerçek odada sahip, odanın gerçek
   * sahibidir; odada değilse koltuğu boş/sessiz görünür.
   */
  const gosterilenHost = useMemo<Seat | null>(() => {
    if (!gercekOda) return host;
    if (isMine) {
      return { name: "Sen", muted: !micOn, lv: userLevel, host: true, photo: userPhoto || undefined, publicId: myPublicId || undefined };
    }
    // Sahip kimliği DB'den kesin; presence yalnızca "şu an odada mı" der.
    const sahipUid = sahipProfil?.id ?? room?.ownerId ?? null;
    const canli =
      (sahipUid != null ? liveMembers.find((m) => m.uid === sahipUid) : undefined) ??
      liveMembers.find((m) => m.name === (sahipProfil?.ad ?? room?.host));

    const ad = canli?.name ?? sahipProfil?.ad ?? room?.host;
    if (!ad) return null;
    return {
      name: ad,
      // Odadaysa canlı fotoğrafı (anlık değişirse presence taşır), değilse
      // profilden çekilen son hâli.
      photo: canli?.photo ?? sahipProfil?.foto,
      publicId: canli?.publicId ?? sahipProfil?.publicId,
      muted: canli ? canli.mic === false : true,
      lv: 0,
      host: true,
    };
  }, [gercekOda, host, isMine, micOn, userLevel, userPhoto, myPublicId, liveMembers, room?.host, room?.ownerId, sahipProfil]);

  /** Sahip şu an odada mı — koltuğu soluk gösterip "Ayrıldı" yazmak için. */
  const sahipOdada = useMemo(() => {
    if (!gercekOda) return true;
    if (isMine) return true;
    const sahipUid = sahipProfil?.id ?? room?.ownerId ?? null;
    if (sahipUid != null) return liveMembers.some((m) => m.uid === sahipUid);
    return liveMembers.some((m) => m.name === (sahipProfil?.ad ?? room?.host));
  }, [gercekOda, isMine, liveMembers, sahipProfil, room?.ownerId, room?.host]);

  const occupants = useMemo(
    () => [gosterilenHost, ...gosterilenKoltuklar].filter(Boolean) as Seat[],
    [gosterilenKoltuklar, gosterilenHost],
  );

  // Header/sayaç için birleşik kalabalık: DB odasında presence, yoksa koltuklar (mock)
  const crowd: { key: string; name: string; photo?: string; cerceve?: string | null }[] = isDbRoom
    ? liveMembers.map((m) => ({
        key: "u" + m.uid,
        name: m.name,
        photo: m.uid === myDbId ? userPhoto || undefined : m.photo,
        cerceve: m.uid === myDbId ? kusanili.cerceve : m.cerceve,
      }))
    : occupants.map((o, i) => ({
        key: (o.name || "u") + i,
        name: o.name,
        photo: o.name === "Sen" ? userPhoto || undefined : undefined,
        cerceve: o.name === "Sen" ? kusanili.cerceve : undefined,
      }));
  const crowdCount = isDbRoom ? liveMembers.length : occupants.length;

  // Oda ayarları CANLI (039): sahip tema/kapak/isim/duyuru değiştirince odadakiler
  // yeniden girmeden görsün. (Herkese açık oda; kilitli odada RLS gereği yalnız sahip.)
  useEffect(() => {
    const sb = supabase;
    if (!isDbRoom || !dbId || !sb) return;
    const ch = sb
      .channel(`oda-ayar-${dbId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "odalar", filter: `id=eq.${dbId}` },
        ({ new: row }) => {
          const r = row as { ad?: string; aciklama?: string | null; kategori?: string | null; kapak_url?: string | null; herkese_acik?: boolean };
          patchCurrentRoom({
            name: r.ad,
            // `|| undefined` idi: açıklama SİLİNDİĞİNDE undefined gidiyor,
            // patchCurrentRoom da "değişmemiş" sayıp eski duyuruyu bırakıyordu.
            announce: r.aciklama ?? "",
            scene: toScene(r.kategori ?? null),
            photo: r.kapak_url || undefined,
            locked: r.herkese_acik === undefined ? undefined : !r.herkese_acik,
          });
        },
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [isDbRoom, dbId, patchCurrentRoom]);

  // Gerçek oda: Realtime presence + ANLIK sohbet (Broadcast — DB'ye yazmaz,
  // geçmiş tutmaz; sonradan giren/çıkıp-giren temiz sohbetle başlar).
  useEffect(() => {
    const sb = supabase;
    if (!isDbRoom || !dbId || !sb) return;
    let alive = true;

    // Kanal adı SABİT olmalı (room-<id>) — tüm cihazlar aynı kanala girer.
    const topic = `room-${dbId}`;
    sb.getChannels().forEach((c) => { if (c.topic === topic || c.topic === `realtime:${topic}`) sb.removeChannel(c); });
    const ch = sb.channel(topic, { config: { presence: { key: String(myDbId ?? Math.random()) }, broadcast: { self: true } } });
    chanRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      type PresUser = { uid?: number; name?: string; photo?: string; publicId?: string; cerceve?: string; balon?: string; giris?: string; koltuk?: number | null; mic?: boolean; katildi?: number };
      const state = ch.presenceState() as Record<string, PresUser[]>;
      const map = new Map<number, { name: string; photo?: string; publicId?: string }>();
      const members: LiveMember[] = [];
      for (const arr of Object.values(state)) {
        for (const p of arr) {
          if (p.uid == null) continue;
          map.set(p.uid, { name: p.name || "Kullanıcı", photo: p.photo, publicId: p.publicId });
          if (!members.some((m) => m.uid === p.uid)) {
            members.push({
              uid: p.uid,
              name: p.name || "Kullanıcı",
              photo: p.photo,
              publicId: p.publicId,
              // 056: kuşanılan eşyalar presence yüküyle taşınıyor — herkesin
              // çerçevesi/balonu için ayrı sorgu atmaya gerek kalmıyor.
              cerceve: p.cerceve,
              balon: p.balon,
              giris: p.giris,
              koltuk: p.koltuk ?? null,
              mic: p.mic,
              katildi: p.katildi,
            });
          }
        }
      }
      memberMapRef.current = map;

      // TEŞHİS (geçici): presence'ta kim, hangi koltukta, fotoğrafı ne.
      console.log(
        "[presence] " +
          members
            .map((m) => `${m.uid}:${m.name}:koltuk=${m.koltuk}:mic=${m.mic ? 1 : 0}:foto=${(m.photo || "-").slice(0, 28)}`)
            .join("  ||  "),
      );

      // Yeni gireni yakala → giriş efektini/bildirimini oynat.
      //
      // Eskiden yalnızca "önceki sync'te yoktu" bakılıyordu ve İLK sync
      // tamamen atlanıyordu. İkimiz aynı anda girince karşı taraf ilk
      // snapshot'ta beliriyor, yani hiç duyurulmuyordu — "arkadaşımın giriş
      // efekti bende görünmüyor"un sebebi buydu. Artık presence yükündeki
      // `katildi` damgasına da bakıyoruz: son 15 saniyede girmiş biri, ilk
      // sync'te görünse bile duyurulur. `duyurulanlarRef` tekrarı önler.
      const onceki = girenlerRef.current;
      const simdi = Date.now();
      for (const m of members) {
        if (m.uid === myDbId) continue; // kendi efektim mount'ta zaten oynuyor
        if (duyurulanlarRef.current.has(m.uid)) continue;
        const yeniGeldi = onceki ? !onceki.has(m.uid) : !!m.katildi && simdi - m.katildi < 15000;
        if (!yeniGeldi) continue;
        duyurulanlarRef.current.add(m.uid);
        setGirisKuyrugu((q) => [...q, { anahtar: `${m.uid}-${simdi}`, uid: m.uid, ad: m.name, tema: m.giris ?? null }]);
      }
      // Odadan çıkanı listeden düş ki tekrar girince yine duyurulsun.
      for (const uid of [...duyurulanlarRef.current]) {
        if (!members.some((m) => m.uid === uid)) duyurulanlarRef.current.delete(uid);
      }
      girenlerRef.current = new Set(members.map((m) => m.uid));

      // Odadaki kişi sayısını DB'ye yaz (057). Bu kolon hiç yazılmıyordu:
      // oda listesi "boş odaları gösterme" kuralını buna göre uyguladığı için
      // yeni kurulan odalar hiçbir sekmede görünmüyordu. Yazma işini odadaki
      // TEK bir istemci yapar (en küçük uid) — herkes yazsa gereksiz trafik olur.
      if (dbId && myDbId != null && members.length > 0) {
        const yazan = Math.min(...members.map((m) => m.uid));
        if (yazan === myDbId && sayacRef.current !== members.length) {
          sayacRef.current = members.length;
          odaKatilimciYaz(dbId, members.length).catch(() => {});
        }
      }

      if (alive) setLiveMembers(members);
    });

    // Anlık sohbet — broadcast (DB yok). self:true → kendi mesajım da gelir.
    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      const p = payload as { uid?: number; name?: string; photo?: string; publicId?: string; text: string; time: string; hediye?: HediyeSatiri };
      const mine = p.uid != null && p.uid === myDbId;
      // Kendi hediyemi zaten yerel olarak ekledim; broadcast kopyasını atla.
      if (mine && p.hediye) return;
      if (alive) setMsgs((prev) => [...prev, {
        name: mine ? userName : p.name || "Kullanıcı",
        time: p.time,
        text: p.text,
        myOwn: mine,
        photo: mine ? userPhoto || undefined : p.photo,
        uid: p.uid,
        publicId: mine ? myPublicId || undefined : p.publicId,
        hediye: p.hediye,
      }]);
    });

    // Yönetici sistem mesajı / uyarısı — o an içeridekilere canlı baloncuk.
    ch.on("broadcast", { event: "system" }, ({ payload }) => {
      const p = payload as { tur?: "mesaj" | "uyari"; baslik?: string; text: string; time?: string };
      if (alive) setMsgs((prev) => [...prev, {
        name: "Sistem", time: p.time || new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        text: p.text, sys: p.tur === "uyari" ? "uyari" : "mesaj", baslik: p.baslik,
      }]);
    });

    // Mikrofon sırası — ephemeral (broadcast). El kaldır / vazgeç / onayla.
    ch.on("broadcast", { event: "mic_queue" }, ({ payload }) => {
      const p = payload as { kind: "raise" | "lower" | "approve"; uid: number; name?: string; photo?: string; publicId?: string; at?: number };
      if (!alive || p.uid == null) return;
      if (p.kind === "raise") {
        setMicQueue((q) => (q.some((e) => e.uid === p.uid) ? q : [...q, { uid: p.uid, name: p.name || "Kullanıcı", photo: p.photo, publicId: p.publicId, at: p.at ?? Date.now() }]));
      } else {
        setMicQueue((q) => q.filter((e) => e.uid !== p.uid));
        if (p.kind === "approve" && p.uid === myDbId) sitFirstEmptyRef.current();
      }
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await presenceYaz();
    });

    addXp("oda_katilim"); // günde 1 kez sayılır (sunucu tavanlar)
    logRoomMovement(dbId, "giris"); // moderasyon geçmişi (best-effort)
    // Odam > "Son günlerde" listesinin kaynağı. Hareket logu yönetici gözüyle
    // tutuluyor (SELECT'i kullanıcıya kapalı), bu ise kullanıcının kendi
    // geçmişi — oda başına tek satır.
    ziyaretKaydet(dbId).catch((e) => console.warn("[ziyaret]", e?.message || e));

    return () => {
      alive = false; chanRef.current = null; ch.untrack(); sb.removeChannel(ch);
      logRoomMovement(dbId, "cikis"); // best-effort: uygulama zorla kapanırsa düşmeyebilir
      // Son çıkan sayacı sıfırlar; başkaları kaldıysa kalan en küçük uid bir
      // sonraki sync'te doğru sayıyı zaten yazacak.
      const kalan = Math.max(0, (girenlerRef.current?.size ?? 1) - 1);
      odaKatilimciYaz(dbId, kalan).catch(() => {});
    };
    // userName/userPhoto oturum boyunca sabit; bağımlılığa eklemiyoruz (yeniden abone olmasın)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDbRoom, dbId, myDbId]);

  const toast = (msg: string) => {
    setSeatToast(msg);
    setTimeout(() => setSeatToast(""), 1800);
  };

  const send = () => {
    if (!input.trim()) return;
    if (micBan) { setMicBanModal(true); return; } // mic yasaklı → yazamaz
    const t = input.trim();
    setInput("");
    if (isDbRoom && chanRef.current) {
      // Anlık yayın (DB'ye yazmaz). self:true sayesinde kendi mesajımız da
      // broadcast dinleyicisine düşer → çift eklemeyiz.
      const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      chanRef.current.send({ type: "broadcast", event: "chat", payload: { uid: myDbId, name: userName, photo: userPhoto || undefined, publicId: myPublicId || undefined, text: t, time } });
      addXp("oda_mesaj"); // +2/mesaj, günlük tavan sunucuda
      return;
    }
    setMsgs((m) => [...m, { name: "Sen", time: "21:49", text: t, myOwn: true }]);
  };

  const sitHere = (idx: number) => {
    // Oda sahibinin kendi koltuğu var; sıradan koltuğa geçemez.
    if (isMine) { setSeatSheet(null); toast("Oda sahibi kendi koltuğunda oturur"); return; }
    if (micBan) { setSeatSheet(null); setMicBanModal(true); return; } // mic yasaklı → koltuğa çıkamaz
    haptic.light();
    setSeats((p) => {
      const arr = [...p];
      if (mySeat !== null) arr[mySeat] = null;
      arr[idx] = { name: "Sen", muted: false, lv: userLevel, speaking: false };
      return arr;
    });
    const wasNull = mySeat === null;
    setMySeat(idx);
    setMicOn(true);
    // Presence'i effect'in bir sonraki turunu beklemeden yaz — arada karşı
    // taraf koltuğu boş görüyordu.
    presenceYaz({ koltuk: idx, mic: true });
    setSeatSheet(null);
    toast(wasNull ? "Mikrofona geçtin" : "Koltuk değiştirildi");
  };
  const leaveSeat = () => {
    if (mySeat === null) return;
    setSeats((p) => p.map((t, i) => (i === mySeat ? null : t)));
    setMySeat(null);
    setMicOn(false);
    presenceYaz({ koltuk: null, mic: false });
    setSeatSheet(null);
    toast("Mikrofondan indin");
  };

  // Sıradan onaylanınca ilk boş (kilitsiz) koltuğa oturt — her render'da güncel state'i görsün diye ref
  sitFirstEmptyRef.current = () => {
    if (mySeat !== null) { toast("Zaten mikrofondasın"); return; }
    const idx = gosterilenKoltuklar.findIndex((s, i) => !s && !seatLocks[i]);
    if (idx < 0) { toast("Boş koltuk yok"); return; }
    sitHere(idx);
    toast("Mikrofona alındın 🎙");
  };

  /**
   * Presence yükünü yaz/güncelle.
   *
   * Koltuk ve mikrofon durumu da buraya kondu: koltuklar eskiden tamamen
   * YEREL state'ti, kimse kimsenin mikrofona çıktığını görmüyordu. Presence
   * broadcast'ten farklı olarak sonradan girene de aktarılır — yani odaya
   * geç katılan da kimin mikrofonda olduğunu görür.
   */
  const presenceYaz = useCallback(async (ustuneYaz?: { koltuk?: number | null; mic?: boolean }) => {
    const ch = chanRef.current;
    if (!ch || myDbId == null) { console.log("[presence] YAZILAMADI kanal/uid yok", !!ch, myDbId); return; }
    const k = useApp.getState().kusanili;
    console.log(
      `[presence] yaziyorum uid=${myDbId} koltuk=${ustuneYaz?.koltuk !== undefined ? ustuneYaz.koltuk : isMine ? -1 : mySeat} mic=${ustuneYaz?.mic ?? micOn} foto=${(userPhoto || "-").slice(0, 28)}`,
    );
    await ch
      .track({
        uid: myDbId,
        name: userName,
        photo: userPhoto || undefined,
        publicId: myPublicId || undefined,
        cerceve: k.cerceve || undefined,
        balon: k.balon || undefined,
        giris: k.giris || undefined,
        // Oturma/kalkma anında state henüz güncellenmemiş olabilir; çağıran
        // yeni değeri doğrudan geçebilsin diye üzerine yazılabiliyor.
        koltuk: ustuneYaz?.koltuk !== undefined ? ustuneYaz.koltuk : isMine ? -1 : mySeat,
        mic: ustuneYaz?.mic ?? micOn,
        katildi: katildiRef.current,
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDbId, userName, userPhoto, myPublicId, mySeat, micOn, isMine]);

  // Koltuk / mikrofon değişince presence tazelensin.
  useEffect(() => { presenceYaz(); }, [presenceYaz]);

  // Mikrofon sırası aksiyonları (broadcast; self:true → kendi eventimiz de düşer)
  const queueSend = (payload: object) => chanRef.current?.send({ type: "broadcast", event: "mic_queue", payload });
  const raiseHand = () => {
    if (myDbId == null) return;
    if (isMine) { toast("Zaten kendi koltuğundasın"); return; } // sahip sıraya giremez
    if (micBan) { setMicBanModal(true); return; } // mic yasaklı → el kaldıramaz
    haptic.light();
    queueSend({ kind: "raise", uid: myDbId, name: userName, photo: userPhoto || undefined, publicId: myPublicId || undefined, at: Date.now() });
  };
  const lowerHand = (uid?: number) => {
    const u = uid ?? myDbId;
    if (u == null) return;
    haptic.light();
    queueSend({ kind: "lower", uid: u });
  };
  const approveHand = (uid: number) => {
    haptic.success();
    queueSend({ kind: "approve", uid });
  };
  const myRaised = myDbId != null && micQueue.some((e) => e.uid === myDbId);
  const toggleMyMic = () => {
    const next = !micOn;
    haptic.light();
    setMicOn(next);
    presenceYaz({ mic: next });
    if (isMine) setHost((h) => (h ? { ...h, muted: !next } : h));
    else if (mySeat !== null) setSeats((p) => p.map((t, i) => (i === mySeat && t ? { ...t, muted: !next } : t)));
    toast(next ? "Mikrofonun açık" : "Mikrofonun kapalı");
  };
  const toggleLock = (idx: number) => {
    setSeatLocks((p) => p.map((v, i) => (i === idx ? !v : v)));
    setSeatSheet(null);
    toast(seatLocks[idx] ? "Koltuk kilidi açıldı" : "Koltuk kilitlendi");
  };
  const tapSeat = (idx: number) => {
    if (seatLocks[idx]) {
      if (MY_ROLE === "host") setSeatSheet(idx);
      else toast("Bu koltuk kilitli");
      return;
    }
    setSeatSheet(idx);
  };
  // Odadan at: DB odada kalıcı yasak (022), mock odada eski geçici liste.
  const banOrKick = (t: { name: string; publicId?: string; photo?: string | null }) => {
    if (isDbRoom && dbId && t.publicId) {
      banRoomUserByPublicId(dbId, t.publicId).catch((e) => {
        console.warn("[oda-yasak]", (e as Error)?.message || e);
        toast((e as Error)?.message || "Yasaklanamadı");
      });
    } else {
      kickFromRoom({ name: t.name, publicId: t.publicId, photo: t.photo }, userName);
    }
  };
  const seatActions = (s: Seat) => ({
    onMute: () => setSeats((p) => p.map((t) => (t && t.name === s.name ? { ...t, muted: !t.muted } : t))),
    onKickMic: () => setSeats((p) => p.map((t) => (t && t.name === s.name ? null : t))),
    onKickRoom: () => {
      setSeats((p) => p.map((t) => (t && t.name === s.name ? null : t)));
      banOrKick(s);
    },
  });
  const hostActions = () => ({
    onMute: () => setHost((h) => (h ? { ...h, muted: !h.muted } : h)),
    onKickMic: () => setHost(null),
    onKickRoom: () => {
      if (host) banOrKick(host);
      setHost(null);
    },
  });
  const openMyCard = () => {
    const seated = mySeat !== null;
    const muted = isMine ? !micOn : seated ? !!gosterilenKoltuklar[mySeat]?.muted : !micOn;
    setCardUser({
      name: userName,
      muted,
      lv: userLevel,
      host: isMine || undefined,
      viewerRole: "user",
      self: true,
      authority: privileged,
      photo: userPhoto || undefined,
      publicId: myPublicId || undefined,
      cerceve: kusanili.cerceve,
      onLeaveSeat: seated ? leaveSeat : undefined,
    });
  };
  const tapOccupant = (s: Seat) => {
    if (s.name === "Sen") openMyCard();
    else setCardUser({ ...s, viewerRole: MY_ROLE, ...(s.host ? hostActions() : seatActions(s)) });
  };
  /**
   * Giriş efekti hapına dokunma → girenin kartı.
   *
   * Efekt birkaç saniye ekranda kalıyor; o sırada kişi odadan çıkmış olabilir.
   * Presence listesinde yoksa kart açmak yerine ayrıldığını söylüyoruz.
   */
  const girisKartiAc = (e: { uid?: number; ad: string }) => {
    haptic.light();
    if (e.uid != null && e.uid === myDbId) { openMyCard(); return; }
    const uye = e.uid != null ? liveMembers.find((x) => x.uid === e.uid) : undefined;
    if (!uye) { toast(`${e.ad} odadan ayrıldı`); return; }
    openChatUserCard({ name: uye.name, uid: uye.uid, photo: uye.photo, publicId: uye.publicId, text: "", time: "" });
  };
  // Sohbetteki bir mesajın sahibine dokununca kart aç (koltukta da olabilir, değilse temel kart)
  const openChatUserCard = (m: ChatMsg) => {
    haptic.light();
    if (m.myOwn || m.name === userName || m.name === "Sen") { openMyCard(); return; }
    const seated = m.uid != null ? null : occupants.find((o) => o.name === m.name);
    if (seated) { setCardUser({ ...seated, viewerRole: MY_ROLE, ...seatActions(seated) }); return; }
    // DB odada sohbetteki kullanıcıya (uid biliniyor) yönetici işlemi: kalıcı yasak
    const uid = m.uid;
    setCardUser({
      name: m.name,
      muted: false,
      lv: 0,
      photo: m.photo,
      publicId: m.publicId,
      // Kart açılınca karşı tarafın kuşandığı çerçeve de görünsün (056)
      cerceve: m.uid != null ? liveMembers.find((x) => x.uid === m.uid)?.cerceve : undefined,
      viewerRole: MY_ROLE,
      onKickRoom: isDbRoom && dbId && uid != null
        ? () => banRoomUser(dbId, uid).catch((e) => toast((e as Error)?.message || "Yasaklanamadı"))
        : undefined,
    });
  };
  const openByName = (name: string) => {
    if (name === "Sen") { openMyCard(); return; }
    const s = occupants.find((o) => o.name === name);
    if (s) setCardUser({ ...s, viewerRole: MY_ROLE, ...seatActions(s) });
  };

  const minimize = () => router.back();
  const exit = () => {
    leaveRoom();
    router.back();
  };

  if (!room) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Txt color={C.dim}>Oda bulunamadı</Txt>
      </View>
    );
  }

  const seatSheetIdx = seatSheet;
  const occupiedByMe = seatSheetIdx !== null && mySeat === seatSheetIdx;
  const isEmpty = seatSheetIdx !== null && !seats[seatSheetIdx];

  return (
    <View style={styles.root}>
      {/* Oda zemini = seçilen tema.
          Burada sabit bir gri gradyan vardı; tema yalnızca üst bardaki 36px'lik
          çipin içinde kullanılıyordu, yani tema değiştirmek odada hiçbir şeyi
          değiştirmiyordu. Sahne geri geldi, üstüne de okunabilirlik için koyu
          bir perde çekildi — renk hissediliyor ama yazılar sırıtmıyor. */}
      <Scene kind={room.scene} />
      <Gradient
        colors={["rgba(14,14,17,.62)", "rgba(14,14,17,.78)", "rgba(11,11,13,.90)"]}
        deg={180}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
          <View style={styles.topbar}>
            {/* Geri oku yok: odadan çıkış zaten sağdaki güç düğmesinde ve
                sistemin geri hareketinde. Oda çipi en sola dayanıyor. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => { setPanelOpen(true); }} style={styles.roomChip}>
                <View style={styles.thumb}>
                  {room.photo ? <Image source={{ uri: room.photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
                </View>
                <View style={{ minWidth: 0, flexShrink: 1 }}>
                  <Txt weight="extrabold" size={13.5} color="#fff" numberOfLines={1}>
                    {roomName}
                  </Txt>
                  {/* Odanın kazandığı rozetler ID'nin hemen yanında, dar
                      aralıkla. Rozetler yalnızca oda listesindeki kartta
                      görünüyordu; odanın içinde hiç yoktu. */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
                    <Txt weight="semibold" size={10.5} color="rgba(255,255,255,.55)">
                      ID: {room.id}
                    </Txt>
                    {!!room.badges?.length && <RoomBadges badges={room.badges} size={14} />}
                  </View>
                </View>
              </Pressable>
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <Pressable onPress={() => setStub("Paylaş — yakında")}>
                  <Icon name="share" size={21} color="#fff" />
                </Pressable>
                <Pressable onPress={() => setExitModal(true)}>
                  <Icon name="power" size={21} color="#fff" />
                </Pressable>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <Pressable onPress={() => setContribOpen(true)} style={styles.trophy}>
                <Icon name="bars" size={11} color="#FEF3C7" />
                <Txt weight="bold" size={9.5} color="#FEF3C7">Saatlik sıra</Txt>
                <Icon name="chev" size={11} color="#FEF3C7" />
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "62%" }}>
                {/* Düz View (ScrollView değil): içerik genişliğinde → sayı ikonunun
                    tam yanında durur ve kişi arttıkça sola doğru dizilir.
                    Ters dizi: en yeni/ilk sağda (rozete bitişik). */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {[...crowd.slice(0, 5)].reverse().map((o) => (
                    <Pressable key={o.key} onPress={() => setUserList(true)}>
                      <Portrait name={o.name} size={32} ring="rgba(255,255,255,.22)" photo={o.photo} />
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => setUserList(true)} style={styles.countBadge}>
                  <Icon name="user" size={12} color="rgba(255,255,255,.7)" />
                  <Txt weight="extrabold" size={9} color="#fff">{crowdCount}</Txt>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.stage}>
            {(gosterilenHost || isMine) && (
              <Pressable onPress={() => { if (isMine) openMyCard(); else if (gosterilenHost) tapOccupant(gosterilenHost); }} style={styles.hostSeat}>
                <View>
                  {gosterilenHost?.speaking && <SpeakingRing />}
                  {/* Sahip odada değilse koltuğu soluk — döndüğünde canlanır. */}
                  <View style={{ width: SAHIP_KOLTUK, height: SAHIP_KOLTUK, opacity: sahipOdada ? 1 : 0.42 }}>
                    <Portrait
                      name={isMine ? "Sen" : gosterilenHost?.name ?? "Sahip"}
                      size={SAHIP_KOLTUK}
                      muted={gosterilenHost?.muted}
                      ring={isMine && kusanili.cerceve ? "transparent" : C.gold}
                      glow={!(isMine && kusanili.cerceve)}
                      // BUG: ziyaretçiye HER ZAMAN undefined geçiliyordu —
                      // sahibin fotoğrafı hesaplanıyor ama Portrait'e hiç
                      // verilmiyordu, o yüzden host koltuğu daima silüetti.
                      photo={isMine ? userPhoto || undefined : gosterilenHost?.photo}
                    />
                    {isMine && kusanili.cerceve && <FramePreview id={kusanili.cerceve} size={SAHIP_KOLTUK} />}
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 150 }}>
                  <Txt weight="semibold" size={11} color={sahipOdada ? "#fff" : C.dim}>
                    {isMine ? userName : gosterilenHost?.name ?? "Sahip"}
                  </Txt>
                  {isMine && privileged && <AuthorityTag size={8} />}
                  {!sahipOdada && (
                    <View style={styles.ayrildiCip}>
                      <Txt weight="bold" size={9} color={C.dim}>Ayrıldı</Txt>
                    </View>
                  )}
                </View>
              </Pressable>
            )}
            <View style={styles.grid}>
              {gosterilenKoltuklar.map((s, idx) => (
                <SeatItem
                  key={idx}
                  seat={s}
                  idx={idx}
                  locked={seatLocks[idx]}
                  userPhoto={userPhoto}
                  userName={userName}
                  privileged={privileged}
                  cerceveTema={s?.name === "Sen" ? kusanili.cerceve : undefined}
                  onPress={() => (s ? tapOccupant(s) : tapSeat(idx))}
                />
              ))}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            {/* Giriş efekti (056): mikrofonların hemen altında, sohbetin
                başladığı hizada — soldan sağa açılıp geri toplanır. */}
            {girisKuyrugu[0] && (
              <GirisEfekti
                key={girisKuyrugu[0].anahtar}
                ad={girisKuyrugu[0].ad}
                tema={girisKuyrugu[0].tema}
                onBitti={() => setGirisKuyrugu((q) => q.slice(1))}
                onBas={() => girisKartiAc(girisKuyrugu[0])}
              />
            )}
            <ScrollView ref={chatRef} onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 11 }}>
              <SystemBanner roomName={roomName} />
              {msgs.map((m, i) => {
                // Kendi mesajımda kendi kuşandığım, başkasınınkinde presence'tan gelen tema.
                const uyeler = m.uid != null ? liveMembers.find((x) => x.uid === m.uid) : undefined;
                return (
                  <ChatRow
                    key={i}
                    m={m}
                    userName={userName}
                    userPhoto={userPhoto}
                    privileged={privileged}
                    balonTema={m.myOwn ? kusanili.balon : uyeler?.balon}
                    onSelfPress={openMyCard}
                    onTapUser={openChatUserCard}
                  />
                );
              })}
            </ScrollView>
            {/* Mikrofon sırası — el kaldırma jesti mikrofon ikonundan daha anlaşılır */}
            <Pressable onPress={() => { haptic.light(); setQueueOpen(true); }} style={styles.micQueueFab} hitSlop={6}>
              <Icon name="hand" size={18} color={C.gold} />
              {isDbRoom && micQueue.length > 0 && (
                <View style={styles.micQueueRozet}>
                  <Txt weight="extrabold" size={9} color="#241A05">{micQueue.length}</Txt>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.bottombar}>
            <Pressable onPress={() => { setSpeakerOn((v) => !v); toast(speakerOn ? "Ses kapatıldı" : "Ses açıldı"); }} style={styles.barIcon}>
              <Icon name="mega" size={22} color={speakerOn ? "#fff" : C.dim2} />
            </Pressable>
            <Pressable onPress={toggleMyMic} style={styles.barIcon}>
              <Icon name={micOn ? "mic" : "micoff"} size={21} color={micOn ? C.gold2 : "#fff"} />
            </Pressable>
            <View style={[styles.inputWrap, { marginLeft: 4, marginRight: 6 }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                placeholder="Bir şeyler yaz..."
                placeholderTextColor={C.dim2}
                style={styles.input}
                returnKeyType="send"
              />
            </View>
            {FEATURES.roomGift && (
              <Pressable onPress={() => setGiftOpen(true)} style={styles.giftBtnBig}>
                <Gradient colors={["#EC4899", "#BE185D"]} deg={135} style={styles.giftMini}>
                  <Icon name="gift" size={21} color="#FBCFE8" />
                </Gradient>
              </Pressable>
            )}
          </View>
        </KeyboardAware>

        {seatToast !== "" && (
          <View style={styles.toast}>
            <Txt weight="bold" size={12} color="#fff">{seatToast}</Txt>
          </View>
        )}
      </SafeAreaView>

      <Modal visible={exitModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setExitModal(false)}>
        <Pressable style={styles.exitOverlay} onPress={() => setExitModal(false)}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.exitDim} />
          <View style={styles.exitRow}>
            <Pressable onPress={() => { setExitModal(false); minimize(); }} style={{ alignItems: "center", gap: 11 }}>
              <View style={styles.bigCircle}>
                <Icon path="M9 9L4 4M9 9V5M9 9H5M15 9l5-5M15 9V5M15 9h4M9 15l-5 5M9 15v4M9 15H5M15 15l5 5M15 15v4M15 15h4" size={24} sw={2} color="rgba(255,255,255,.92)" />
              </View>
              <Txt weight="semibold" size={12.5} color="rgba(255,255,255,.78)">Küçült</Txt>
            </Pressable>
            <Pressable onPress={() => { setExitModal(false); exit(); }} style={{ alignItems: "center", gap: 11 }}>
              <View style={styles.bigCircle}>
                <Icon name="power" size={24} sw={2} color="rgba(255,255,255,.92)" />
              </View>
              <Txt weight="semibold" size={12.5} color="rgba(255,255,255,.78)">Çıkış</Txt>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Sheet visible={userList} onClose={() => setUserList(false)} maxHeightRatio={0.72}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Txt weight="displayBold" size={16} color="#fff">Odadaki Kullanıcılar</Txt>
          <Pill bg="rgba(255,255,255,.07)" color={C.dim} border={C.line}>{(isDbRoom ? liveMembers.length : occupants.length)} kişi</Pill>
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 4 }}>
          {isDbRoom
            ? liveMembers.map((m) => {
                const isMe = m.uid === myDbId;
                const rol = roomRoles.get(m.uid);
                return (
                  <Pressable
                    key={m.uid}
                    onPress={() => {
                      setUserList(false);
                      if (isMe) openMyCard();
                      else if (m.publicId) router.navigate(`/user-profile?publicId=${encodeURIComponent(m.publicId)}&name=${encodeURIComponent(m.name)}`);
                    }}
                    style={styles.userRow}
                  >
                    <Portrait
                      name={m.name}
                      size={40}
                      ring={rol === "host" ? C.gold : rol === "mod" ? C.teal : "rgba(255,255,255,.14)"}
                      glow={!!rol}
                      online
                      photo={isMe ? userPhoto || undefined : m.photo}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Txt weight="extrabold" size={12.5} color={rol === "host" ? C.gold2 : C.text}>{isMe ? userName : m.name}</Txt>
                        {rol && <RolePill type={rol} />}
                        {isMe && privileged && <AuthorityTag size={8} />}
                      </View>
                      <Txt weight="semibold" size={10} color={C.green} style={{ marginTop: 3 }}>Odada</Txt>
                    </View>
                    <Icon name="chev" size={13} color={C.dim2} />
                  </Pressable>
                );
              })
            : occupants.map((s) => {
                const isMe = s.name === "Sen";
                return (
                  <Pressable key={s.name} onPress={() => { setUserList(false); tapOccupant(s); }} style={styles.userRow}>
                    <Portrait name={s.name} size={40} ring={s.host ? C.gold : s.mod ? C.teal : "rgba(255,255,255,.14)"} glow={s.host || s.mod} online photo={isMe ? userPhoto || undefined : undefined} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Txt weight="extrabold" size={12.5} color={C.text}>{isMe ? userName : s.name}</Txt>
                        {s.host && <RolePill type="host" />}
                        {s.mod && !s.host && <RolePill type="mod" />}
                        {isMe && privileged && <AuthorityTag size={8} />}
                      </View>
                      <Txt weight="semibold" size={10} color={s.muted ? C.dim2 : C.green} style={{ marginTop: 3 }}>
                        {s.muted ? "🔇 Sessiz" : "🎙️ Konuşuyor"}
                      </Txt>
                    </View>
                    <Icon name="chev" size={13} color={C.dim2} />
                  </Pressable>
                );
              })}
        </ScrollView>
      </Sheet>

      <Sheet visible={seatSheet !== null} onClose={() => setSeatSheet(null)}>
        {seatSheetIdx !== null && (
          <>
            <Txt weight="displayBold" size={16} color="#fff" style={{ marginBottom: 4 }}>{seatSheetIdx + 1}. Koltuk</Txt>
            <Txt size={11} color={C.dim} style={{ marginBottom: 8 }}>
              {seatLocks[seatSheetIdx]
                ? "Bu koltuk kilitli"
                : occupiedByMe
                  ? "Şu an buradasın"
                  : isEmpty
                    ? isMine ? "Boş koltuk · sen kendi koltuğunda oturuyorsun" : "Boş koltuk"
                    : ""}
            </Txt>
            {/* Oda sahibi sıradan koltuğa geçemez — kendi koltuğu sahnenin başında. */}
            {isEmpty && !seatLocks[seatSheetIdx] && !isMine && (
              <ActionRow icon="mic" color={C.gold} label={mySeat === null ? "Bu koltuğa geç" : "Bu koltuğa taşın"} onPress={() => sitHere(seatSheetIdx)} />
            )}
            {occupiedByMe && <ActionRow icon="micoff" color={C.red} label="Mikrofondan in" onPress={leaveSeat} />}
            {MY_ROLE === "host" && (
              <ActionRow icon="lock" color={seatLocks[seatSheetIdx] ? C.green : C.gold} label={seatLocks[seatSheetIdx] ? "Koltuk kilidini aç" : "Koltuğu kilitle"} onPress={() => toggleLock(seatSheetIdx)} />
            )}
            <Pressable onPress={() => setSeatSheet(null)} style={[styles.actionBtn, { justifyContent: "center", marginTop: 8 }]}>
              <Txt weight="bold" size={13} color={C.dim}>Vazgeç</Txt>
            </Pressable>
          </>
        )}
      </Sheet>

      <Sheet visible={!!stub} onClose={() => setStub(null)} contentStyle={{ alignItems: "center" }}>
        <Icon name="gift" size={30} color={C.dim} />
        <Txt weight="bold" size={13} color={C.dim} style={{ marginTop: 12, marginBottom: 4 }}>{stub}</Txt>
      </Sheet>

      <GiftSheet
        visible={giftOpen}
        onClose={() => setGiftOpen(false)}
        // Gerçek odada alıcılar presence'tan gelir (uid'leri var, gönderim
        // gerçekten yapılabilir); demo odada koltuklar listelenir.
        recipients={
          isDbRoom
            ? liveMembers.filter((m) => m.uid !== myDbId).map((m) => ({ name: m.name, uid: m.uid, photo: m.photo }))
            : occupants.map((o) => ({ name: o.name, host: o.host, mod: o.mod }))
        }
        onSend={sendGift}
        onBakiyeYukle={() => { setGiftOpen(false); router.navigate("/wallet"); }}
      />

      {panelOpen && (
        <RoomPanel
          room={room}
          roomName={roomName}
          roomPhoto={roomPhoto}
          announce={roomAnnounce}
          locked={roomLocked}
          memberCount={occupants.length}
          canManage={MY_ROLE === "host"}
          onManage={() => { setPanelOpen(false); router.navigate("/room-manage"); }}
          onReport={() => { setPanelOpen(false); setReportOpen(true); }}
          onStats={() => { setPanelOpen(false); setStatsOpen(true); }}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {/* Mikrofon sırası — oda profilinin sekmesi değil, kendi sayfası */}
      {queueOpen && (
        <MicQueueSheet
          queue={isDbRoom ? micQueue : undefined}
          myUid={myDbId}
          myRaised={myRaised}
          canModerate={MY_ROLE !== "user"}
          // sahip sıraya giremez → "El Kaldır" butonu hiç çıkmasın
          onRaise={isMine ? undefined : raiseHand}
          onLower={lowerHand}
          onApprove={approveHand}
          onClose={() => setQueueOpen(false)}
        />
      )}

      {cardUser && (
        <ProfileCard user={cardUser} superPower={privileged} onClose={() => setCardUser(null)} onDM={() => setCardUser(null)} onViewProfile={() => { const u = cardUser; setCardUser(null); if (u.self) { router.navigate("/profile"); return; } const q = u.publicId ? `publicId=${encodeURIComponent(u.publicId)}&` : ""; router.navigate(`/user-profile?${q}name=${encodeURIComponent(u.name)}&lv=${u.lv}`); }} />
      )}

      {contribOpen && (
        <ContributionView
          occupants={occupants}
          host={room.host}
          onClose={() => setContribOpen(false)}
          onOpenUser={(name) => { setContribOpen(false); openByName(name); }}
        />
      )}

      {statsOpen && <RoomStats room={room} roomName={roomName} roomPhoto={roomPhoto} onClose={() => setStatsOpen(false)} />}

      <CenterModal visible={reportOpen} onClose={() => { setReportOpen(false); setReportReason(null); setReportDetail(""); setReportDone(false); }}>
        <View style={styles.reportCard}>
          {reportDone ? (
            <View style={{ alignItems: "center", paddingVertical: 6 }}>
              <Gradient colors={[C.green, "#059669"]} deg={135} style={styles.reportDone}>
                <Icon name="check" size={28} sw={3} color="#04231A" />
              </Gradient>
              <Txt weight="displayBold" size={16} color="#fff">Rapor gönderildi</Txt>
              <Txt size={11.5} color={C.dim} align="center" style={{ marginTop: 8 }}>Ekibimiz en kısa sürede inceleyecek.</Txt>
              <Pressable onPress={() => { setReportOpen(false); setReportReason(null); setReportDetail(""); setReportDone(false); }} style={{ alignSelf: "stretch", marginTop: 18, borderRadius: 14, overflow: "hidden" }}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 13, alignItems: "center" }}>
                  <Txt weight="extrabold" size={13} color="#241A05">Tamam</Txt>
                </Gradient>
              </Pressable>
            </View>
          ) : (
            <>
              <Txt weight="displayBold" size={16} color="#fff">Odayı Raporla</Txt>
              <Txt size={11.5} color={C.dim} style={{ marginTop: 8, marginBottom: 8 }}>Bu oda neden uygunsuz?</Txt>
              {ROOM_REPORT.map((r) => {
                const on = reportReason === r.t;
                return (
                  <Pressable key={r.t} onPress={() => setReportReason(r.t)} style={[styles.reasonRow, { backgroundColor: on ? C.red + "12" : C.card, borderColor: on ? C.red : C.line }]}>
                    <View style={styles.reasonIcon}>
                      <Icon name={r.ic} size={16} color="#FB7185" />
                    </View>
                    <Txt weight="bold" size={12.5} color={on ? C.red : C.text} style={{ flex: 1 }}>{r.t}</Txt>
                    {on && <Icon name="check" size={15} sw={3} color={C.red} />}
                  </Pressable>
                );
              })}
              {reportReason && (
                <>
                  <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.4, marginTop: 6, marginBottom: 7 }}>DETAY (opsiyonel)</Txt>
                  <TextInput value={reportDetail} onChangeText={setReportDetail} multiline maxLength={300} placeholder="Bu oda hakkında daha fazla bilgi ver..." placeholderTextColor={C.dim2} style={styles.reportDetailInput} />
                  <Pressable
                    onPress={() => {
                      setReportDone(true);
                      if (isDbRoom && dbId && reportReason) {
                        reportRoom(dbId, reportReason, reportDetail, liveMembers.map((m) => ({ uid: m.uid, name: m.name, publicId: m.publicId, photo: m.photo }))).catch(() => toast("Rapor gönderilemedi"));
                      }
                    }}
                    style={{ borderRadius: 14, overflow: "hidden", marginTop: 12 }}
                  >
                    <Gradient colors={["#DC2626", "#7F1D1D"]} deg={135} style={{ paddingVertical: 14, alignItems: "center" }}>
                      <Txt weight="extrabold" size={13} color="#FEE2E2">Raporu Gönder</Txt>
                    </Gradient>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </CenterModal>

      {/* Platform mic-yasağı uyarısı (028) */}
      <CenterModal visible={micBanModal} onClose={() => setMicBanModal(false)} dim={0.82}>
        <View style={[styles.reportCard, { alignItems: "center" }]}>
          <View style={styles.micBanIcon}>
            <Icon name="micoff" size={28} color="#FB7185" />
          </View>
          <Txt weight="displayBold" size={17} color="#fff" style={{ marginTop: 14 }}>Mikrofon Yasağın Var</Txt>
          <Txt size={12} color={C.dim} align="center" lh={1.6} style={{ marginTop: 8 }}>
            Odaya girip dinleyebilirsin ama mesaj yazamaz ve mikrofona çıkamazsın.
          </Txt>
          {!!micBan?.sebep && (
            <View style={styles.micBanRow}>
              <Txt weight="bold" size={10.5} color={C.dim2} style={{ letterSpacing: 0.4 }}>SEBEP</Txt>
              <Txt size={12.5} color={C.text} lh={1.5} style={{ marginTop: 3 }}>{micBan.sebep}</Txt>
            </View>
          )}
          <View style={styles.micBanRow}>
            <Txt weight="bold" size={10.5} color={C.dim2} style={{ letterSpacing: 0.4 }}>SÜRE</Txt>
            <Txt weight="extrabold" size={13} color="#FB7185" style={{ marginTop: 3 }}>
              {micBan?.kalici ? "Kalıcı" : micBan?.bitis ? `Bitiş: ${new Date(micBan.bitis).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}` : "—"}
            </Txt>
          </View>
          <Pressable onPress={() => setMicBanModal(false)} style={{ alignSelf: "stretch", marginTop: 18, borderRadius: 14, overflow: "hidden" }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 13, alignItems: "center" }}>
              <Txt weight="extrabold" size={13} color="#241A05">Anladım</Txt>
            </Gradient>
          </Pressable>
        </View>
      </CenterModal>

      {giftFx && <GiftFx gift={giftFx} />}

      {bigGift && <BigGiftOverlay gift={bigGift.gift} qty={bigGift.qty} sender="Sen" onDone={() => setBigGift(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topbar: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 6 },
  micBanIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.12)", borderWidth: 1, borderColor: "rgba(251,113,133,.3)" },
  micBanRow: { alignSelf: "stretch", marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: C.line },
  micQueueFab: { position: "absolute", right: 12, bottom: 12, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,18,28,.9)", borderWidth: 1, borderColor: C.gold + "55" },
  micQueueRozet: { position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: C.gold2, borderWidth: 1.5, borderColor: C.bg },
  // Yalla tarzı: çip ekranın sol kenarına yapışır, bu yüzden solu köşeli
  // başlar ve sağa doğru ovalleşir. Dolgu çok düşük opaklıkta beyaz —
  // kendi kutusu gibi durmaz, zemine karışır.
  roomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 18,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    // topbar'ın 14'lük yatay dolgusunu iptal ederek ekran kenarına dayanır.
    marginLeft: -14,
    // Genişlik içeriğe göre: oda adı / ID biter bitmez hap kapanır.
    // Alt sınır yok — sabit genişlik uzun boş bir kuyruk bırakıyordu.
    maxWidth: "76%",
    backgroundColor: "rgba(255,255,255,.09)",
  },
  thumb: { width: 36, height: 36, borderRadius: 10, overflow: "hidden" },
  // Oda çipiyle aynı dil: sol duvara yapışık, solu köşeli, sağı ovalleşiyor.
  trophy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3.5,
    paddingLeft: 12,
    paddingRight: 10,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    marginLeft: -14,
    backgroundColor: "rgba(217,119,6,.25)",
  },
  countBadge: { alignItems: "center", justifyContent: "center", minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.1)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
  // WePlay'de ızgaranın yatay dolgusu yok: sütunlar tam ekranın dörtte biri.
  // Dolgu koydukça sütun daralıyor, aynı çaptaki koltuk sıkışık görünüyordu.
  stage: { paddingTop: 10, paddingBottom: 10 },
  hostSeat: { alignItems: "center", marginBottom: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 22 },
  barIcon: { minWidth: 34, height: 42, alignItems: "center", justifyContent: "center" },
  giftMini: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  giftBtnBig: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  bubble: { alignSelf: "flex-start", maxWidth: "94%", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 15, borderTopLeftRadius: 5, borderWidth: 1 },
  // İçerik kadar geniş: eskiden alignSelf "stretch" idi, kısa bir hediye adı
  // için bile satır sohbetin tamamını kaplıyordu.
  ayrildiCip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", backgroundColor: "rgba(255,255,255,.05)" },
  hediyeSatiri: { flexDirection: "row", alignItems: "center", gap: 9, alignSelf: "flex-start", maxWidth: "82%", paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 14, borderTopLeftRadius: 5, borderWidth: 1, overflow: "hidden" },
  hediyeIkon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  sysNotice: { borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  /** Hoş geldiniz sistem mesajı kapsülü — içeriği kadar geniş, sola yaslı */
  welcomeCapsule: {
    flexDirection: "row",
    alignItems: "flex-start",
    alignSelf: "flex-start",
    maxWidth: "72%",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.gold + "3D",
    backgroundColor: "rgba(245,206,110,.09)",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  reportCard: { backgroundColor: "#181620", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  reportDetailInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, color: C.text, fontSize: 12.5, height: 84, textAlignVertical: "top" },
  seat: { width: "25%", alignItems: "center", gap: 6 },
  emptySeat: { borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  seatLock: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#0A0A0F", borderWidth: 1, borderColor: C.gold + "66", alignItems: "center", justifyContent: "center" },
  speakRing: { position: "absolute", top: -7, left: -7, right: -7, bottom: -7, borderRadius: 999, borderWidth: 2, borderColor: C.teal },
  bottombar: { flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6, alignItems: "center" },
  inputWrap: {
    flex: 1,
    justifyContent: "center",
    borderRadius: 26,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.13)",
  },
  input: { color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium", minWidth: 0, paddingVertical: 10 },
  sendBtnWrap: { width: 42, height: 42 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  giftBtnWrap: { width: 50, height: 50, borderRadius: 25, shadowColor: "#EC4899", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 9, elevation: 6 },
  giftBtn: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  toast: { position: "absolute", alignSelf: "center", bottom: 90, backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: C.gold + "55", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", borderRadius: 14, padding: 14, marginTop: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,.03)" },
  bigCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
  exitOverlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  exitDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,8,12,.55)" },
  exitRow: { flexDirection: "row", gap: 48, alignItems: "flex-start" },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 13, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8, borderWidth: 1 },
  reasonIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.12)", borderWidth: 1, borderColor: "rgba(251,113,133,.25)" },
  reportDone: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14 },
});
