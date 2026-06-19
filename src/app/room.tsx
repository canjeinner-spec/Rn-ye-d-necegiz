import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { GiftFx } from "@/components/GiftFx";
import { Pill } from "@/components/Pill";
import { Portrait } from "@/components/Portrait";
import { RolePill } from "@/components/RolePill";
import { Scene } from "@/components/Scene";
import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { GiftSheet } from "@/sheets/GiftSheet";
import { RoomPanel } from "@/sheets/RoomPanel";
import { type Gift } from "@/data/gifts";
import { CHAT0, SEATS, type ChatMsg, type Seat } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const MY_ROLE: "host" | "mod" | "user" = "host";

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
  onPress,
}: {
  seat: Seat | null;
  idx: number;
  locked: boolean;
  userPhoto: string | null;
  onPress: () => void;
}) {
  if (!seat) {
    return (
      <Pressable style={styles.seat} onPress={onPress}>
        <View style={[styles.emptySeat, { borderColor: locked ? C.gold + "66" : C.line }]}>
          <Icon name={locked ? "lock" : "plus"} size={locked ? 18 : 22} sw={2.2} color={locked ? C.gold : C.dim2} />
        </View>
        <Txt weight="semibold" size={10} color={locked ? C.gold : C.dim2}>
          {locked ? "Kilitli" : "Boş"}
        </Txt>
      </Pressable>
    );
  }
  const ring = seat.host ? C.gold : seat.mod ? C.purple2 : seat.speaking ? C.purple2 : seat.ring || "rgba(255,255,255,.16)";
  return (
    <Pressable style={styles.seat} onPress={onPress}>
      <View>
        {seat.speaking && <SpeakingRing />}
        <Portrait
          name={seat.name}
          size={60}
          muted={seat.muted}
          photo={seat.name === "Sen" ? userPhoto || undefined : undefined}
          ring={ring}
          glow={seat.speaking || seat.host || seat.mod}
        />
        {locked && (
          <View style={styles.seatLock}>
            <Icon name="lock" size={10} color={C.gold} />
          </View>
        )}
      </View>
      <Txt weight="bold" size={10.5} color={seat.name === "Sen" ? C.gold : C.text} numberOfLines={1} style={{ maxWidth: 68 }}>
        {seat.name}
      </Txt>
    </Pressable>
  );
}

function ChatRow({ m }: { m: ChatMsg }) {
  const role = m.host ? ("host" as const) : m.mod ? ("mod" as const) : null;
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start" }}>
      <Portrait name={m.name} size={30} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Txt weight="extrabold" size={11.5} color={m.host ? C.gold : m.mod ? C.purple2 : "rgba(255,255,255,.7)"}>
            {m.name}
          </Txt>
          {role && <RolePill type={role} />}
        </View>
        <Txt size={13} color="#EDEBF2" lh={1.45} style={{ marginTop: 2 }}>
          {m.text}
        </Txt>
      </View>
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
  const { currentRoom, userPhoto, leaveRoom, fireBroadcast } = useApp();
  const room = currentRoom;

  const [seats, setSeats] = useState<(Seat | null)[]>(() => {
    const arr: (Seat | null)[] = Array(8).fill(null);
    SEATS.forEach((s, i) => {
      if (i < 8) arr[i] = s;
    });
    return arr;
  });
  const [msgs, setMsgs] = useState<ChatMsg[]>(CHAT0);
  const [input, setInput] = useState("");
  const [seatLocks, setSeatLocks] = useState<boolean[]>(() => Array(8).fill(false));
  const [mySeat, setMySeat] = useState<number | null>(null);
  const [seatSheet, setSeatSheet] = useState<number | null>(null);
  const [seatToast, setSeatToast] = useState("");
  const [exitModal, setExitModal] = useState(false);
  const [userList, setUserList] = useState(false);
  const [cardSeat, setCardSeat] = useState<Seat | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftFx, setGiftFx] = useState<(Gift & { qty: number }) | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [roomName, setRoomName] = useState(room?.name ?? "");
  const [roomPhoto] = useState<string | null>(room?.photo ?? null);
  const [announce, setAnnounce] = useState("Resmî odaya hoş geldiniz! Lütfen nazik olun, keyifli sohbetler dileriz.");
  const [locked, setLocked] = useState(false);
  const [, setRoomPass] = useState("");
  const [stub, setStub] = useState<string | null>(null);

  const sendGift = (g: Gift, qty: number, recipient: string) => {
    setGiftOpen(false);
    setGiftFx({ ...g, qty });
    const dur = g.tier === "legendary" ? 3600 : g.tier === "epic" ? 3000 : 2400;
    setTimeout(() => setGiftFx(null), dur);
    if (g.tier === "legendary" && room) {
      fireBroadcast({ sender: "Sen", recipient, qty, room, gift: g });
    }
  };

  const occupants = useMemo(() => seats.filter(Boolean) as Seat[], [seats]);

  const toast = (msg: string) => {
    setSeatToast(msg);
    setTimeout(() => setSeatToast(""), 1800);
  };

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { name: "Sen", time: "21:49", text: input.trim(), myOwn: true }]);
    setInput("");
  };

  const sitHere = (idx: number) => {
    setSeats((p) => {
      const arr = [...p];
      if (mySeat !== null) arr[mySeat] = null;
      arr[idx] = { name: "Sen", muted: false, lv: 12, speaking: false };
      return arr;
    });
    const wasNull = mySeat === null;
    setMySeat(idx);
    setSeatSheet(null);
    toast(wasNull ? "Mikrofona geçtin" : "Koltuk değiştirildi");
  };
  const leaveSeat = () => {
    if (mySeat === null) return;
    setSeats((p) => p.map((t, i) => (i === mySeat ? null : t)));
    setMySeat(null);
    setSeatSheet(null);
    toast("Mikrofondan indin");
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
  const tapOccupant = (s: Seat) => {
    if (s.name === "Sen") setSeatSheet(seats.findIndex((t) => t?.name === "Sen"));
    else setCardSeat(s);
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
      <Scene kind={room.scene} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.topbar}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <Pressable onPress={() => setPanelOpen(true)} style={styles.roomChip}>
                <View style={styles.thumb}>
                  <Scene kind={room.scene} />
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 5 }}>
                <Pressable onPress={() => setStub("Paylaş — yakında")}>
                  <Icon name="share" size={21} color="#fff" />
                </Pressable>
                <Pressable onPress={() => setExitModal(true)}>
                  <Icon name="power" size={21} color="#fff" />
                </Pressable>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <Pressable onPress={() => setStub("Katkı Sıralaması — Aşama 3d")} style={styles.trophy}>
                <Txt size={14}>🏆</Txt>
                <Txt weight="extrabold" size={12} color="#FEF3C7">103</Txt>
                <Icon name="chev" size={12} color="#FEF3C7" />
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "62%" }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
                  {occupants.slice(0, 7).map((o, i) => (
                    <Pressable key={(o.name || "u") + i} onPress={() => setUserList(true)}>
                      <Portrait name={o.name} size={32} ring="rgba(255,255,255,.22)" />
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable onPress={() => setUserList(true)} style={styles.countBadge}>
                  <Icon name="user" size={12} color="rgba(255,255,255,.7)" />
                  <Txt weight="extrabold" size={9} color="#fff">{occupants.length}</Txt>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.grid}>
            {seats.map((s, idx) => (
              <SeatItem
                key={idx}
                seat={s}
                idx={idx}
                locked={seatLocks[idx]}
                userPhoto={userPhoto}
                onPress={() => (s ? tapOccupant(s) : tapSeat(idx))}
              />
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 11 }}>
            {msgs.map((m, i) => (
              <ChatRow key={i} m={m} />
            ))}
          </ScrollView>

          <View style={styles.bottombar}>
            <View style={styles.inputWrap}>
              <TextInput
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                placeholder="Mesaj yaz..."
                placeholderTextColor={C.dim2}
                style={styles.input}
                returnKeyType="send"
              />
              <Pressable onPress={send} disabled={!input.trim()} style={styles.sendBtnWrap}>
                {input.trim() ? (
                  <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.sendBtn}>
                    <Icon name="send" size={18} sw={2} color="#241A05" />
                  </Gradient>
                ) : (
                  <View style={[styles.sendBtn, { backgroundColor: "rgba(255,255,255,.07)" }]}>
                    <Icon name="send" size={18} sw={2} color={C.dim2} />
                  </View>
                )}
              </Pressable>
            </View>
            <Pressable onPress={() => setGiftOpen(true)} style={styles.giftBtnWrap}>
              <Gradient colors={["#EC4899", "#BE185D"]} deg={135} style={styles.giftBtn}>
                <Icon name="gift" size={24} color="#FBCFE8" />
              </Gradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {seatToast !== "" && (
          <View style={styles.toast}>
            <Txt weight="bold" size={12} color="#fff">{seatToast}</Txt>
          </View>
        )}
      </SafeAreaView>

      <Sheet visible={exitModal} onClose={() => setExitModal(false)} contentStyle={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 48, paddingVertical: 6 }}>
          <Pressable onPress={() => { setExitModal(false); minimize(); }} style={{ alignItems: "center", gap: 11 }}>
            <View style={styles.bigCircle}>
              <Icon name="minimize" size={24} sw={2} color="rgba(255,255,255,.92)" />
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
      </Sheet>

      <Sheet visible={userList} onClose={() => setUserList(false)} maxHeightRatio={0.72}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Txt weight="displayBold" size={16} color="#fff">Odadaki Kullanıcılar</Txt>
          <Pill bg="rgba(255,255,255,.07)" color={C.dim} border={C.line}>{occupants.length} kişi</Pill>
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 4 }}>
          {occupants.map((s) => (
            <Pressable key={s.name} onPress={() => { setUserList(false); tapOccupant(s); }} style={styles.userRow}>
              <Portrait name={s.name} size={40} ring={s.host ? C.gold : s.mod ? C.purple2 : "rgba(255,255,255,.14)"} glow={s.host || s.mod} online />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Txt weight="extrabold" size={12.5} color={C.text}>{s.name}</Txt>
                  {s.host && <RolePill type="host" />}
                  {s.mod && !s.host && <RolePill type="mod" />}
                </View>
                <Txt weight="semibold" size={10} color={s.muted ? C.dim2 : C.green} style={{ marginTop: 3 }}>
                  {s.muted ? "🔇 Sessiz" : "🎙️ Konuşuyor"}
                </Txt>
              </View>
              <Icon name="chev" size={13} color={C.dim2} />
            </Pressable>
          ))}
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

      <Sheet visible={!!cardSeat} onClose={() => setCardSeat(null)} contentStyle={{ alignItems: "center" }}>
        {cardSeat && (
          <>
            <Portrait name={cardSeat.name} size={84} ring={cardSeat.host ? C.gold : C.purple2} glow online />
            <Txt weight="extrabold" size={17} color="#fff" style={{ marginTop: 12 }}>{cardSeat.name}</Txt>
            <Txt weight="semibold" size={12} color={C.dim} style={{ marginTop: 4 }}>Lv {cardSeat.lv} · ProfileCard — Aşama 3d</Txt>
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
          setRoomName={setRoomName}
          roomPhoto={roomPhoto}
          announce={announce}
          setAnnounce={setAnnounce}
          locked={locked}
          setLocked={setLocked}
          setRoomPass={setRoomPass}
          memberCount={occupants.length}
          canManage={MY_ROLE === "host"}
          onReport={() => { setPanelOpen(false); setStub("Oda Raporla — Aşama 3d"); }}
          onStats={() => { setPanelOpen(false); setStub("Oda İstatistikleri — Aşama 3d"); }}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {giftFx && <GiftFx gift={giftFx} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topbar: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
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
  thumb: { width: 38, height: 38, borderRadius: 10, overflow: "hidden" },
  trophy: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingLeft: 8, paddingRight: 12, borderRadius: 8, backgroundColor: "rgba(217,119,6,.25)" },
  countBadge: { alignItems: "center", justifyContent: "center", minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.1)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  seat: { width: "25%", alignItems: "center", gap: 6 },
  emptySeat: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.02)" },
  seatLock: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#0A0A0F", borderWidth: 1, borderColor: C.gold + "66", alignItems: "center", justifyContent: "center" },
  speakRing: { position: "absolute", top: -7, left: -7, right: -7, bottom: -7, borderRadius: 999, borderWidth: 2, borderColor: C.purple2 },
  bottombar: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, alignItems: "center" },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 26,
    paddingLeft: 20,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 8,
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.13)",
  },
  input: { flex: 1, color: C.text, fontSize: 13.5, fontFamily: "PlusJakartaSans_500Medium", minWidth: 0, paddingVertical: 8 },
  sendBtnWrap: { width: 42, height: 42 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  giftBtnWrap: { width: 50, height: 50, borderRadius: 25, shadowColor: "#EC4899", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 9, elevation: 6 },
  giftBtn: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  toast: { position: "absolute", alignSelf: "center", bottom: 90, backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: C.gold + "55", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", borderRadius: 14, padding: 14, marginTop: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,.03)" },
  bigCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
});
