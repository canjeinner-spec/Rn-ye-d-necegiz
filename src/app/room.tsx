import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { RolePill } from "@/components/RolePill";
import { Scene } from "@/components/Scene";
import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { ContributionView } from "@/sheets/ContributionView";
import { GiftSheet } from "@/sheets/GiftSheet";
import { ProfileCard, type ProfileCardUser } from "@/sheets/ProfileCard";
import { RoomPanel } from "@/sheets/RoomPanel";
import { RoomStats } from "@/sheets/RoomStats";
import { type Gift } from "@/data/gifts";
import { reportRoom } from "@/data/remote/reportRepo";
import { addXp } from "@/data/remote/xpRepo";
import { amIBannedFromRoom, banRoomUser, banRoomUserByPublicId, getMyMicBan, getRoomMembers, logRoomMovement, toScene, type MicBan } from "@/data/remote/roomsRepo";
import { CHAT0, SEATS, type ChatMsg, type Seat } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { FEATURES } from "@/lib/features";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C, Room } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const SYS_MSGS = ["Oda Sahibi · Oda modu değiştirildi", "Oda Sahibi · Oda imzası değiştirildi"];

// WePlay oda ölçüleri (res/layout/room_new_head_view + simple_new_owner_seat_view)
const SEAT_AVATAR = 54;      // normal koltuk avatarı
const OWNER_AVATAR = 68;     // sahip koltuğu avatarı
const SEAT_RING = "#FFD78F"; // avatar çerçevesi (1dp)
const STAGE_SIDE = 22;       // koltuk alanının yan boşluğu

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
  onPress,
}: {
  seat: Seat | null;
  idx: number;
  locked: boolean;
  userPhoto: string | null;
  userName: string;
  privileged: boolean;
  onPress: () => void;
}) {
  // WePlay `room_new_head_view`: 54dp avatar, 1dp #FFD78F çerçeve, isim 12sp
  // beyaz ve avatardan 8dp altta, susturma ikonu sağ-altta 24dp.
  if (!seat) {
    return (
      <Pressable style={styles.seat} onPress={onPress}>
        <View style={styles.emptySeat}>
          <Icon name={locked ? "lock" : "plus"} size={locked ? 18 : 22} sw={2} color="rgba(255,255,255,.55)" />
        </View>
        <Txt weight="medium" size={12} color={Room.textDim} numberOfLines={1} style={styles.seatName}>
          {locked ? "Kilitli" : String(idx + 2)}
        </Txt>
      </Pressable>
    );
  }
  const isMe = seat.name === "Sen";
  return (
    <Pressable style={styles.seat} onPress={onPress}>
      <View>
        {seat.speaking && <SpeakingRing />}
        <Portrait
          name={seat.name}
          size={SEAT_AVATAR}
          muted={seat.muted}
          photo={isMe ? userPhoto || undefined : undefined}
          ring={SEAT_RING}
          glow={seat.speaking}
        />
        {locked && (
          <View style={styles.seatLock}>
            <Icon name="lock" size={10} color={C.gold} />
          </View>
        )}
      </View>
      <Txt weight="medium" size={12} color={Room.text} numberOfLines={1} style={styles.seatName}>
        {isMe ? userName : seat.name}
      </Txt>
      {isMe && privileged && <AuthorityTag size={8} />}
    </Pressable>
  );
}

function ChatRow({
  m,
  userName,
  userPhoto,
  privileged,
  onSelfPress,
  onTapUser,
}: {
  m: ChatMsg;
  userName: string;
  userPhoto: string | null;
  privileged: boolean;
  onSelfPress: () => void;
  onTapUser?: (m: ChatMsg) => void;
}) {
  if (m.sys) return <SystemNotice m={m} />;
  const role = m.host ? ("host" as const) : m.mod ? ("mod" as const) : null;
  const isMe = !!m.myOwn || m.name === "Sen";
  const displayName = isMe ? userName : m.name;
  const tap = () => (isMe ? onSelfPress() : onTapUser?.(m));
  // sohbet baloncuğu — kuşanılan balona göre tema (envanter: sohbet_balonu)
  const bubble = m.myOwn ? "gold" : m.host ? "host" : m.mod ? "mod" : "plain";
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start" }}>
      <Pressable onPress={tap}>
        <Portrait name={m.name} size={30} photo={isMe ? userPhoto || undefined : m.photo} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
          <Pressable onPress={tap}>
            <Txt weight="extrabold" size={11.5} color={m.host ? C.gold : m.mod ? C.teal : isMe ? C.gold2 : "rgba(255,255,255,.7)"}>
              {displayName}
            </Txt>
          </Pressable>
          {role && <RolePill type={role} />}
          {isMe && privileged && <AuthorityTag size={8} />}
        </View>
        {bubble === "gold" ? (
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

function SystemBanner({ roomName }: { roomName: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
      <View style={{ paddingTop: 2 }}><Icon name="bell" size={13} color={C.gold2} /></View>
      <Txt size={12.5} color="rgba(255,255,255,.72)" lh={1.5} style={{ flex: 1 }}>
        <Txt weight="extrabold" size={12.5} color={C.gold2}>Sistem: </Txt>
        {roomName}'na hoş geldiniz. Oda; pornografik, taciz, yasa dışı ve kural ihlali içeren içerikler paylaşılamaz. Kural ihlali ile karşılaşırsanız lütfen zamanında bildirin.
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
  const isMine = !!room && (room.owner === true || room.host === "Sen");

  // Gerçek (DB) oda mı? → canlı sohbet + presence
  const dbId = room?.dbId;
  const isDbRoom = !!dbId && isSupabaseConfigured && !!session;

  // Oda içi rolüm: DB odada gerçek üyelikten (sahip→host, yardimci→mod);
  // mock odada eski demo davranışı (host) korunur.
  const [myRoomRole, setMyRoomRole] = useState<"host" | "mod" | "user">(isDbRoom ? "user" : "host");
  useEffect(() => {
    if (!isDbRoom || !dbId) return;
    let alive = true;
    getRoomMembers(dbId)
      .then(({ myRole }) => {
        if (!alive) return;
        setMyRoomRole(myRole === "sahip" ? "host" : myRole === "yardimci" ? "mod" : "user");
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

  const [host, setHost] = useState<Seat | null>(() => SEATS.find((s) => s.host) ?? null);
  const [seats, setSeats] = useState<(Seat | null)[]>(() => {
    const arr: (Seat | null)[] = Array(8).fill(null);
    SEATS.filter((s) => !s.host).forEach((s, i) => {
      if (i < 8) arr[i] = s;
    });
    return arr;
  });
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => (isDbRoom ? [] : CHAT0));
  const [liveMembers, setLiveMembers] = useState<{ uid: number; name: string; photo?: string; publicId?: string }[]>([]);
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
  const [panelTab, setPanelTab] = useState(0);
  // currentRoom'a bağlı (donuk değil) → sahip kapak/tema değiştirince canlı yansır.
  const roomPhoto = room?.photo ?? null;
  const [stub, setStub] = useState<string | null>(null);

  const sendGift = (g: Gift, qty: number, recipient: string) => {
    g.tier === "legendary" ? haptic.heavy() : haptic.success();
    setGiftOpen(false);
    if (g.tier === "legendary") {
      setBigGift({ gift: g, qty });
      if (room) fireBroadcast({ sender: "Sen", recipient, qty, room, gift: g });
      return;
    }
    setGiftFx({ ...g, qty });
    const dur = g.tier === "epic" ? 3000 : 2400;
    setTimeout(() => setGiftFx(null), dur);
  };

  const occupants = useMemo(() => [host, ...seats].filter(Boolean) as Seat[], [seats, host]);

  // Header/sayaç için birleşik kalabalık: DB odasında presence, yoksa koltuklar (mock)
  const crowd = isDbRoom
    ? liveMembers.map((m) => ({ key: "u" + m.uid, name: m.name, photo: m.uid === myDbId ? userPhoto || undefined : m.photo }))
    : occupants.map((o, i) => ({ key: (o.name || "u") + i, name: o.name, photo: o.name === "Sen" ? userPhoto || undefined : undefined }));
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
            announce: r.aciklama || undefined,
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
      const state = ch.presenceState() as Record<string, { uid?: number; name?: string; photo?: string; publicId?: string }[]>;
      const map = new Map<number, { name: string; photo?: string; publicId?: string }>();
      const members: { uid: number; name: string; photo?: string; publicId?: string }[] = [];
      for (const arr of Object.values(state)) {
        for (const p of arr) {
          if (p.uid == null) continue;
          map.set(p.uid, { name: p.name || "Kullanıcı", photo: p.photo, publicId: p.publicId });
          if (!members.some((m) => m.uid === p.uid)) members.push({ uid: p.uid, name: p.name || "Kullanıcı", photo: p.photo, publicId: p.publicId });
        }
      }
      memberMapRef.current = map;
      if (alive) setLiveMembers(members);
    });

    // Anlık sohbet — broadcast (DB yok). self:true → kendi mesajım da gelir.
    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      const p = payload as { uid?: number; name?: string; photo?: string; publicId?: string; text: string; time: string };
      const mine = p.uid != null && p.uid === myDbId;
      if (alive) setMsgs((prev) => [...prev, {
        name: mine ? userName : p.name || "Kullanıcı",
        time: p.time,
        text: p.text,
        myOwn: mine,
        photo: mine ? userPhoto || undefined : p.photo,
        uid: p.uid,
        publicId: mine ? myPublicId || undefined : p.publicId,
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
      if (status === "SUBSCRIBED") await ch.track({ uid: myDbId, name: userName, photo: userPhoto || undefined, publicId: myPublicId || undefined });
    });

    addXp("oda_katilim"); // günde 1 kez sayılır (sunucu tavanlar)
    logRoomMovement(dbId, "giris"); // moderasyon geçmişi (best-effort)

    return () => {
      alive = false; chanRef.current = null; ch.untrack(); sb.removeChannel(ch);
      logRoomMovement(dbId, "cikis"); // best-effort: uygulama zorla kapanırsa düşmeyebilir
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
    setSeatSheet(null);
    toast(wasNull ? "Mikrofona geçtin" : "Koltuk değiştirildi");
  };
  const leaveSeat = () => {
    if (mySeat === null) return;
    setSeats((p) => p.map((t, i) => (i === mySeat ? null : t)));
    setMySeat(null);
    setMicOn(false);
    setSeatSheet(null);
    toast("Mikrofondan indin");
  };

  // Sıradan onaylanınca ilk boş (kilitsiz) koltuğa oturt — her render'da güncel state'i görsün diye ref
  sitFirstEmptyRef.current = () => {
    if (mySeat !== null) { toast("Zaten mikrofondasın"); return; }
    const idx = seats.findIndex((s, i) => !s && !seatLocks[i]);
    if (idx < 0) { toast("Boş koltuk yok"); return; }
    sitHere(idx);
    toast("Mikrofona alındın 🎙");
  };

  // Mikrofon sırası aksiyonları (broadcast; self:true → kendi eventimiz de düşer)
  const queueSend = (payload: object) => chanRef.current?.send({ type: "broadcast", event: "mic_queue", payload });
  const raiseHand = () => {
    if (myDbId == null) return;
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
    const muted = isMine ? !!host?.muted : seated ? !!seats[mySeat]?.muted : !micOn;
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
      onLeaveSeat: seated ? leaveSeat : undefined,
    });
  };
  const tapOccupant = (s: Seat) => {
    if (s.name === "Sen") openMyCard();
    else setCardUser({ ...s, viewerRole: MY_ROLE, ...(s.host ? hostActions() : seatActions(s)) });
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
      {/* Mat & ferah oda zemini (renkli Scene yerine) */}
      <Gradient colors={["#1E1E22", "#161619", "#0F0F11"]} deg={180} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
          <View style={styles.topbar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={minimize} hitSlop={8} style={{ padding: 2 }}>
                <Icon name="back" size={22} color="#fff" />
              </Pressable>
              <Pressable onPress={() => { setPanelTab(0); setPanelOpen(true); }} style={styles.roomChip}>
                <View style={styles.thumb}>
                  {room.photo ? <Image source={{ uri: room.photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
                </View>
                <View style={{ minWidth: 0, flexShrink: 1 }}>
                  <Txt weight="extrabold" size={12.5} color="#fff" numberOfLines={1}>
                    {roomName}
                  </Txt>
                  <Txt weight="semibold" size={9.5} color="rgba(255,255,255,.5)">
                    ID: {room.id}
                  </Txt>
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
            {(host || isMine) && (
              <Pressable onPress={() => { if (isMine) openMyCard(); else if (host) tapOccupant(host); }} style={styles.hostSeat}>
                <View>
                  {host?.speaking && <SpeakingRing />}
                  <Portrait name={isMine ? "Sen" : host!.name} size={OWNER_AVATAR} muted={host?.muted} ring={SEAT_RING} glow photo={isMine ? userPhoto || undefined : undefined} />
                </View>
                {/* WePlay: sahip adı avatardan 18dp altta, 12sp beyaz */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18, flexWrap: "wrap", justifyContent: "center", maxWidth: 140 }}>
                  <Txt weight="semibold" size={12} color={Room.text}>{isMine ? userName : host!.name}</Txt>
                  {isMine && privileged && <AuthorityTag size={8} />}
                </View>
              </Pressable>
            )}
            {/* WePlay dizilimi: satır başına 2+2 koltuk, gruplar arası geniş
                boşluk (ağırlık 3:1:3). Satır 1 sahipten 26dp, satır 2 ondan 6dp. */}
            {([[0, 1, 2, 3], [4, 5, 6, 7]] as const).map((rowIdx, r) => (
              <View key={r} style={[styles.seatRow, { marginTop: r === 0 ? 26 : 6 }]}>
                {([rowIdx.slice(0, 2), rowIdx.slice(2)] as const).map((group, g) => (
                  <Fragment key={g}>
                    {g === 1 && <View style={styles.seatGap} />}
                    <View style={styles.seatGroup}>
                      {group.map((idx) => {
                        const s = seats[idx];
                        return (
                          <SeatItem
                            key={idx}
                            seat={s}
                            idx={idx}
                            locked={seatLocks[idx]}
                            userPhoto={userPhoto}
                            userName={userName}
                            privileged={privileged}
                            onPress={() => {
                              if (s) tapOccupant(s);
                              else tapSeat(idx);
                            }}
                          />
                        );
                      })}
                    </View>
                  </Fragment>
                ))}
              </View>
            ))}
          </View>

          <View style={{ flex: 1 }}>
            <ScrollView ref={chatRef} onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 11 }}>
              <SystemBanner roomName={roomName} />
              {SYS_MSGS.map((s, i) => (
                <View key={"sys" + i} style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Icon name="bell" size={13} color={C.gold2} />
                  <Txt weight="extrabold" size={12} color={C.gold2}>Sistem:</Txt>
                  <Txt size={12.5} color="rgba(255,255,255,.7)">{s}</Txt>
                </View>
              ))}
              {msgs.map((m, i) => (
                <ChatRow key={i} m={m} userName={userName} userPhoto={userPhoto} privileged={privileged} onSelfPress={openMyCard} onTapUser={openChatUserCard} />
              ))}
            </ScrollView>
            <Pressable onPress={() => { haptic.light(); setPanelTab(2); setPanelOpen(true); }} style={styles.micQueueFab} hitSlop={6}>
              <Icon name="mic" size={18} color={C.gold} />
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
            {/* MVP: oda içi hediye ikonu gizli (FEATURES.roomGift) */}
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
                    <Portrait name={m.name} size={40} ring="rgba(255,255,255,.14)" online photo={isMe ? userPhoto || undefined : m.photo} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Txt weight="extrabold" size={12.5} color={C.text}>{isMe ? userName : m.name}</Txt>
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
              {seatLocks[seatSheetIdx] ? "Bu koltuk kilitli" : occupiedByMe ? "Şu an buradasın" : isEmpty ? "Boş koltuk" : ""}
            </Txt>
            {isEmpty && !seatLocks[seatSheetIdx] && (
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

      <GiftSheet visible={giftOpen} onClose={() => setGiftOpen(false)} recipients={occupants} coins={860} onSend={sendGift} />

      {panelOpen && (
        <RoomPanel
          room={room}
          roomName={roomName}
          roomPhoto={roomPhoto}
          announce={roomAnnounce}
          locked={roomLocked}
          memberCount={occupants.length}
          canManage={MY_ROLE === "host"}
          initialTab={panelTab}
          queue={isDbRoom ? micQueue : undefined}
          myRaised={myRaised}
          myUid={myDbId}
          canModerateQueue={MY_ROLE !== "user"}
          onRaise={raiseHand}
          onLower={lowerHand}
          onApprove={approveHand}
          onManage={() => { setPanelOpen(false); router.navigate("/room-manage"); }}
          onReport={() => { setPanelOpen(false); setReportOpen(true); }}
          onStats={() => { setPanelOpen(false); setStatsOpen(true); }}
          onClose={() => setPanelOpen(false)}
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
  roomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 13,
    borderRadius: 14,
    maxWidth: "66%",
    backgroundColor: "rgba(0,0,0,.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
  },
  thumb: { width: 32, height: 32, borderRadius: 9, overflow: "hidden" },
  trophy: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingLeft: 7, paddingRight: 8, borderRadius: 8, backgroundColor: "rgba(217,119,6,.25)" },
  countBadge: { alignItems: "center", justifyContent: "center", minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.1)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
  /** WePlay: koltuk alanı yanlardan 22dp, sahip koltuğu üstten 25dp */
  stage: { paddingHorizontal: STAGE_SIDE, paddingTop: 25, paddingBottom: 4 },
  hostSeat: { alignItems: "center" },
  /** Satır: [2 koltuk] [geniş boşluk] [2 koltuk] — ağırlık 3:1:3 */
  seatRow: { flexDirection: "row", alignItems: "flex-start" },
  seatGroup: { flex: 3, flexDirection: "row", justifyContent: "space-between" },
  seatGap: { flex: 1 },
  barIcon: { minWidth: 34, height: 42, alignItems: "center", justifyContent: "center" },
  giftMini: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  giftBtnBig: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  bubble: { alignSelf: "flex-start", maxWidth: "94%", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 15, borderTopLeftRadius: 5, borderWidth: 1 },
  sysNotice: { borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  reportCard: { backgroundColor: "#181620", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  reportDetailInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, color: C.text, fontSize: 12.5, height: 84, textAlignVertical: "top" },
  /** WePlay: koltuk hücresi avatar genişliğinde, isim 8dp altta */
  seat: { width: SEAT_AVATAR, alignItems: "center" },
  seatName: { width: SEAT_AVATAR, marginTop: 8, textAlign: "center" },
  emptySeat: {
    width: SEAT_AVATAR,
    height: SEAT_AVATAR,
    borderRadius: SEAT_AVATAR / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Room.seatEmpty,
  },
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
