import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { KeyboardAware } from "@/components/KeyboardAware";
import { Portrait } from "@/components/Portrait";
import { OfficialAvatar, SystemAvatar } from "@/components/SpecialAvatars";
import { Txt } from "@/components/Txt";
import { GiftSheet } from "@/sheets/GiftSheet";
import { ARON_POSTS, SYSTEM_POSTS } from "@/data/dm";
import { listAnnouncements, type Announcement } from "@/data/remote/announceRepo";
import { getBlockStateByPublicId, unblock } from "@/data/remote/blockRepo";
import { getMessages, mapRealtimeMessage, markRead, sendMessage } from "@/data/remote/dmRepo";
import { type Gift } from "@/data/gifts";
import { Icon } from "@/icons/Icon";
import { FEATURES } from "@/lib/features";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Msg = { id?: number; me: boolean; text?: string; gift?: Gift; qty?: number; time: string };

/**
 * DM dizisi tavanı — room.tsx ile aynı gerekçe: sohbet bir ScrollView ve
 * `msgs.map` her mesajı çiziyor. Geçmiş `dm_mesajlari` tablosunda duruyor.
 */
const MSG_TAVAN = 200;

function IconBtn({ name, onPress }: { name: "back" | "phone"; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconBtn}>
      <Icon name={name} size={16} color={C.text} />
    </Pressable>
  );
}

export default function DMChatScreen() {
  const router = useRouter();
  const peer = useApp((s) => s.activeDM);
  const dbId = useApp((s) => s.dbId);
  const back = () => router.back();

  const convId = peer?.convId;
  const isRealDM = !!convId && isSupabaseConfigured;
  const scrollRef = useRef<ScrollView>(null);

  const [msgs, setMsgs] = useState<Msg[]>(() =>
    isRealDM || !peer
      ? []
      : [
          { me: false, text: peer.last || "Selam!", time: peer.time || "21:40" },
          { me: true, text: "Geliyorum birazdan 🙌", time: "21:49" },
        ]
  );
  const [input, setInput] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [block, setBlock] = useState<{ iBlocked: boolean; blockedByThem: boolean; targetId: number | null } | null>(null);

  // Resmi/sistem hesabı → gerçek duyuruları yükle (kanal: system→'sistem', official→'aron')
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured || !(peer?.official || peer?.system)) return;
    let alive = true;
    listAnnouncements(peer.system ? "sistem" : "aron").then((a) => { if (alive) setAnnouncements(a); }).catch(() => {});
    return () => { alive = false; };
  }, [peer?.official, peer?.system]);

  // Engel durumunu yükle (gerçek kişi sohbeti; resmi/sistem hariç)
  useEffect(() => {
    if (!isSupabaseConfigured || !peer?.publicId || peer.official || peer.system) return;
    let alive = true;
    getBlockStateByPublicId(peer.publicId).then((b) => { if (alive) setBlock(b); }).catch(() => {});
    return () => { alive = false; };
  }, [peer?.publicId, peer?.official, peer?.system]);

  const unblockPeer = async () => {
    if (!block || block.targetId == null) return;
    haptic.medium();
    try { await unblock(block.targetId); setBlock({ ...block, iBlocked: false }); } catch { /* sessiz */ }
  };

  // Gerçek DM: mesajları yükle + okundu işaretle + realtime dinle
  useEffect(() => {
    const sb = supabase;
    if (!isRealDM || !convId || !sb) return;
    let alive = true;
    getMessages(convId).then((m) => { if (alive) setMsgs(m.slice(-MSG_TAVAN)); }).catch(() => {});
    markRead(convId).catch(() => {});
    const ch = sb
      .channel(`dm-${convId}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_mesajlari", filter: `konusma_id=eq.${convId}` }, (payload) => {
        const msg = mapRealtimeMessage(payload.new as never, dbId);
        setMsgs((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg].slice(-MSG_TAVAN)));
        if (!msg.me) markRead(convId).catch(() => {});
      })
      .subscribe();
    return () => { alive = false; sb.removeChannel(ch); };
  }, [convId, isRealDM, dbId]);

  const openPeerProfile = () => {
    if (!peer) return;
    haptic.light();
    const q = peer.publicId ? `publicId=${encodeURIComponent(peer.publicId)}&` : "";
    router.navigate(`/user-profile?${q}name=${encodeURIComponent(peer.name)}`);
  };

  const send = async () => {
    const t = input.trim();
    if (!t) return;
    if (block?.blockedByThem || block?.iBlocked) return; // engelliyken gönderme
    setInput("");
    if (isRealDM && convId) {
      try {
        const msg = await sendMessage(convId, t);
        setMsgs((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg].slice(-MSG_TAVAN)));
      } catch { /* gönderilemezse sessiz geç */ }
      return;
    }
    setMsgs((m) => [...m, { me: true, text: t, time: "Şimdi" }].slice(-MSG_TAVAN));
  };
  const sendGift = (g: Gift, qty: number) => {
    haptic.success();
    setGiftOpen(false);
    setMsgs((m) => [...m, { me: true, gift: g, qty, time: "Şimdi" }].slice(-MSG_TAVAN));
  };

  if (!peer) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Txt color={C.dim}>Sohbet bulunamadı</Txt>
      </View>
    );
  }

  // ── Resmi / Sistem yayın akışı ──
  if (peer.official || peer.system) {
    const isSystem = !!peer.system;
    const duyuruTarih = (at: number) => {
      const d = new Date(at);
      return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    // Gerçek duyurular varsa onları; yoksa mock (yer tutucu) göster.
    const posts: { date: string; text: string; icon?: string; title?: string; foto?: string; uyari?: boolean }[] =
      announcements && announcements.length
        ? announcements.map((a) => ({ date: duyuruTarih(a.at), text: a.icerik, title: a.baslik, icon: "🔔", foto: a.foto, uyari: a.tur === "uyari" }))
        : isSystem ? SYSTEM_POSTS : ARON_POSTS;
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={styles.bcHeader}>
            <IconBtn name="back" onPress={back} />
            <View style={{ flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
              <Txt weight="displayBold" size={15} color="#fff">{peer.name}</Txt>
              {peer.official && (
                <View style={styles.verify}>
                  <Icon name="check" size={9} sw={3} color="#fff" />
                </View>
              )}
            </View>
            <Pressable><Txt weight="bold" size={12} color={C.dim}>Temizle</Txt></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 14 }}>
            {posts.map((p, i) => (
              <View key={i}>
                <View style={{ alignItems: "center", marginBottom: 10 }}>
                  <Txt weight="semibold" size={10} color={C.dim2} style={styles.dateTag}>{p.date}</Txt>
                </View>
                <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  {isSystem ? <SystemAvatar size={38} /> : <OfficialAvatar size={38} />}
                  <View style={[styles.bcCard, p.uyari && { borderColor: "rgba(251,113,133,.5)", backgroundColor: "rgba(251,113,133,.08)" }]}>
                    {p.uyari && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 7 }}>
                        <Icon name="flag" size={13} color="#FB7185" />
                        <Txt weight="extrabold" size={10.5} color="#FB7185" style={{ letterSpacing: 0.5 }}>RESMÎ UYARI</Txt>
                      </View>
                    )}
                    {isSystem && p.title && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <Txt size={16}>{p.icon}</Txt>
                        <Txt weight="extrabold" size={12.5} color={C.text}>{p.title}</Txt>
                      </View>
                    )}
                    {!isSystem && p.title && <Txt weight="extrabold" size={13} color={C.text} style={{ marginBottom: 6 }}>{p.title}</Txt>}
                    {!!p.foto && <View style={styles.bcFoto}><Image source={{ uri: p.foto }} style={StyleSheet.absoluteFill} contentFit="cover" /></View>}
                    <Txt size={12.5} color="#DBD9E2" lh={1.55}>{p.text}</Txt>
                    {!isSystem && (
                      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: C.line }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Txt weight="bold" size={12} color={C.purple2}>Görüntüle</Txt>
                          <Icon name="chev" size={13} color={C.purple2} />
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {!isSystem && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingTop: 10 }}>
              <Pressable onPress={() => { haptic.light(); router.navigate("/support"); }} style={{ flex: 1, borderRadius: 999, overflow: "hidden" }}>
                <Gradient colors={["#60A5FA", "#2563EB"]} deg={135} style={styles.csBtn}>
                  <Icon name="user" size={17} color="#fff" />
                  <Txt weight="extrabold" size={13.5} color="#fff">Müşteri Hizmetleri</Txt>
                </Gradient>
              </Pressable>
              <View style={{ alignItems: "center", gap: 3 }}>
                <Icon name="edit" size={19} color={C.dim} />
                <Txt weight="semibold" size={9.5} color={C.dim}>Geri Bildirim</Txt>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  // ── Normal sohbet ──
  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
          <View style={styles.chatHeader}>
            <IconBtn name="back" onPress={back} />
            <Pressable onPress={openPeerProfile} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 11 }}>
              <Portrait name={peer.name} size={38} online={peer.online} photo={peer.photo} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={13.5} color="#fff" numberOfLines={1}>{peer.name}</Txt>
                <Txt weight="bold" size={10} color={peer.online ? C.green : C.dim}>{peer.online ? "Çevrimiçi" : "Profili gör"}</Txt>
              </View>
            </Pressable>
            <IconBtn name="phone" />
          </View>

          <ScrollView ref={scrollRef} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 16, gap: 9 }} showsVerticalScrollIndicator={false}>
            {msgs.map((m, i) =>
              m.gift ? (
                <View key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "76%" }}>
                  <View style={styles.giftBubble}>
                    <Txt size={34}>{m.gift.emoji}</Txt>
                    <Txt weight="extrabold" size={11.5} color={C.text}>{m.gift.name} ×{m.qty}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <DiamondBadge size={12} />
                      <Txt weight="bold" size={10.5} color={C.gold2}>{(m.gift.price * (m.qty || 1)).toLocaleString("tr-TR")}</Txt>
                    </View>
                  </View>
                  <Txt size={9} color={C.dim2} align="right" style={{ marginTop: 4 }}>{m.time}</Txt>
                </View>
              ) : m.me ? (
                <View key={i} style={{ alignSelf: "flex-end", maxWidth: "76%" }}>
                  <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={[styles.bubble, { borderTopRightRadius: 5 }]}>
                    <Txt size={12.5} color="#fff" lh={1.5}>{m.text}</Txt>
                    <Txt size={9} color="rgba(255,255,255,.65)" align="right" style={{ marginTop: 4 }}>{m.time}</Txt>
                  </Gradient>
                </View>
              ) : (
                <View key={i} style={[styles.bubble, styles.bubbleThem]}>
                  <Txt size={12.5} color={C.text} lh={1.5}>{m.text}</Txt>
                  <Txt size={9} color={C.dim2} align="right" style={{ marginTop: 4 }}>{m.time}</Txt>
                </View>
              )
            )}
          </ScrollView>

          {block?.blockedByThem ? (
            // Twitter tarzı: karşı taraf engellemiş → sohbet kapalı
            <View style={styles.blockBar}>
              <Icon name="blockuser" size={15} color={C.dim} />
              <Txt weight="bold" size={12} color={C.dim} align="center">Bu kişi sizi engelledi. Mesaj gönderemezsiniz.</Txt>
            </View>
          ) : block?.iBlocked ? (
            <View style={styles.blockBar}>
              <Icon name="blockuser" size={15} color="#FB7185" />
              <Txt weight="bold" size={12} color="#FB7185" style={{ flex: 1 }}>Bu kişiyi engellediniz.</Txt>
              <Pressable onPress={unblockPeer} hitSlop={8}>
                <Txt weight="extrabold" size={12} color={C.gold2}>Engeli kaldır</Txt>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, alignItems: "center" }}>
              <View style={styles.inputWrap}>
                <TextInput value={input} onChangeText={setInput} onSubmitEditing={send} placeholder="Mesajını yaz..." placeholderTextColor={C.dim2} style={styles.input} returnKeyType="send" />
              </View>
              {FEATURES.dmGift && (
                <Pressable onPress={() => setGiftOpen(true)} style={styles.giftBtn}>
                  <Icon name="crown" size={18} color={C.gold2} />
                </Pressable>
              )}
              <Pressable onPress={send} style={{ borderRadius: 22, overflow: "hidden" }}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.sendBtn}>
                  <Icon name="send" size={17} sw={2} color="#241A05" />
                </Gradient>
              </Pressable>
            </View>
          )}
        </KeyboardAware>
      </SafeAreaView>

      <GiftSheet visible={giftOpen} onClose={() => setGiftOpen(false)} recipients={[{ name: peer.name }]} onSend={sendGift} onBakiyeYukle={() => { setGiftOpen(false); router.navigate("/wallet"); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  bcHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  verify: { width: 15, height: 15, borderRadius: 8, backgroundColor: "#3B82F6", alignItems: "center", justifyContent: "center" },
  dateTag: { backgroundColor: "rgba(255,255,255,.05)", paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: "hidden" },
  bcCard: { flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 18, borderTopLeftRadius: 6, padding: 14 },
  bcFoto: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.line, marginBottom: 9, backgroundColor: "rgba(255,255,255,.04)" },
  csBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 15, borderRadius: 999 },
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 16 },
  bubbleThem: { alignSelf: "flex-start", maxWidth: "76%", backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderTopLeftRadius: 5 },
  giftBubble: { alignItems: "center", gap: 6, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 18, backgroundColor: "rgba(124,58,237,.14)", borderWidth: 1, borderColor: C.gold + "44" },
  inputWrap: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, justifyContent: "center" },
  input: { color: C.text, fontSize: 12.5, fontFamily: "PlusJakartaSans_500Medium", paddingVertical: 11 },
  giftBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.gold + "44", backgroundColor: C.gold + "14", alignItems: "center", justifyContent: "center" },
  sendBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  blockBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginHorizontal: 16, marginTop: 8, marginBottom: 6, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: C.line },
});
