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
import { hediyeAdHaritasi, hediyeDmCoz, hediyeDmMetni, hediyeGonder, type KatalogHediyesi } from "@/data/remote/hediyeRepo";
import { giftPng } from "@/gifts/giftPng";
import { sceneFor } from "@/gifts/bigGifts";
import { Anim } from "@/components/Anim";
import { CenterModal } from "@/components/CenterModal";
import { getPublicProfile } from "@/data/remote/profileRepo";
import { getMessages, mapRealtimeMessage, markRead, sendMessage } from "@/data/remote/dmRepo";
import { type Gift } from "@/data/gifts";
import { Icon } from "@/icons/Icon";
import { FEATURES } from "@/lib/features";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * `okundu` alanı `DMMessage`ten geliyor (dmRepo). Yerel tipe de eklendi,
 * yoksa hediye animasyonunun "ilk görüşte oyna" kararı okunamaz.
 */
type Msg = { id?: number; me: boolean; text?: string; gift?: Gift; qty?: number; time: string; okundu?: boolean };

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
  /** Karşı tarafın sayısal kimliği — hediye göndermek için şart. */
  const [peerUid, setPeerUid] = useState<number | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const dbId = useApp((s) => s.dbId);
  const back = () => router.back();

  /**
   * Hediye adı -> katalog satırı. Hediye DM'e düz METİN olarak gidiyor
   * ("🎁 Gül ×1"), yani mesajda hediyenin kodu yok. Görseli çizebilmek için
   * adı katalogdan çözüyoruz. Katalog okunamazsa harita boş kalır ve mesaj
   * eskisi gibi metin olarak görünür — akış kırılmıyor.
   */
  const [hediyeAdlari, setHediyeAdlari] = useState<Map<string, KatalogHediyesi>>(new Map());
  useEffect(() => { hediyeAdHaritasi().then(setHediyeAdlari).catch(() => {}); }, []);

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
  /** Hediye kutusu açılırken seçili gelecek kod ("Karşılık ver"). */
  const [giftSecim, setGiftSecim] = useState<string | null>(null);
  /** Hediyeye dokununca açılan tam boy önizleme. */
  const [onizleme, setOnizleme] = useState<{ kod: string | null; ad: string; emoji: string } | null>(null);
  /**
   * Animasyonu OYNAMIŞ hediye mesajlarının id'leri.
   *
   * Okunmamış hediye ilk görüşte oynasın isteniyor; ama ekran her yeniden
   * render olduğunda (yeni mesaj, klavye, tazeleme) baştan oynamamalı.
   * `okundu` sunucudan gelen tek seferlik bilgi, bu küme ise aynı oturum
   * içindeki tekrarları engelliyor.
   */
  const oynayanlar = useRef<Set<number>>(new Set());
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
    // Hediye gönderimi sayısal kimlik istiyor; `peer` yalnız publicId taşıyor.
    getPublicProfile(peer.publicId).then((p) => { if (alive) setPeerUid(p?.id ?? null); }).catch(() => {});
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
  /**
   * DM'den hediye — GERÇEK gönderim (059).
   *
   * Eskiden yalnızca yerel bir mesaj ekleniyordu: RPC yok, bakiye düşmüyor,
   * karşı taraf hiçbir şey almıyordu. Kullanıcıya başarılı görünen bir
   * yalandı (yol haritası 1.13).
   *
   * `peer` sayısal kimlik taşımıyor (yalnız `publicId`), o yüzden alıcı
   * kimliği ekran açılırken `getPublicProfile` ile bir kez çözülüyor.
   * Oda dışı gönderim olduğu için `oda_id` NULL gidiyor.
   */
  const sendGift = async (g: Gift, qty: number, _kime: string, aliciId?: number, hediyeDbId?: number) => {
    setGiftOpen(false);
    const hedefId = aliciId ?? peerUid;
    if (!isSupabaseConfigured) return;
    if (hedefId == null) { setHata("Alıcı bulunamadı."); return; }
    if (!hediyeDbId) { setHata("Hediye katalogu yüklenemedi, tekrar dene."); return; }
    try {
      await hediyeGonder(hediyeDbId, qty, hedefId, null);
      haptic.success();
      // Hediye sohbete KALICI olarak düşsün. Eskiden yalnız yerel bir
      // baloncuk ekleniyordu: karşı taraf görmüyordu, çık-gir yapınca
      // kayboluyordu. Dönen mesajın id'si var, realtime echo'su elenir.
      if (convId) {
        try {
          const msg = await sendMessage(convId, hediyeDmMetni(g.name, qty));
          setMsgs((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg].slice(-MSG_TAVAN)));
        } catch {
          setMsgs((m) => [...m, { me: true, gift: g, qty, time: "Şimdi" }].slice(-MSG_TAVAN));
        }
      } else {
        setMsgs((m) => [...m, { me: true, gift: g, qty, time: "Şimdi" }].slice(-MSG_TAVAN));
      }
    } catch (e) {
      haptic.warning();
      setHata((e as Error)?.message || "Hediye gönderilemedi");
    }
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
                    {!!p.foto && <View style={styles.bcFoto}><Image source={{ uri: p.foto }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} /></View>}
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
            {msgs.map((m, i) => {
              // Metni hediye olarak çözmeyi dene; çözülemezse normal baloncuk.
              const cozum = m.text ? hediyeDmCoz(m.text) : null;
              const katalogSatiri = cozum ? hediyeAdlari.get(cozum.ad) : undefined;
              const png = giftPng(katalogSatiri?.kod);
              /**
               * ÇÖZÜLDÜYSE HEDİYE BALONCUĞU — görsel bulunamasa bile.
               *
               * Önce `cozum && png` şartı vardı; katalog haritası yüklenmeden
               * ya da hediye katalogdan kalkmışsa mesaj ham metne düşüyordu
               * ("🎁 Gül ×1"), ki düzeltmeye çalıştığımız şey buydu. Artık
               * görsel yoksa katalogdaki emoji, o da yoksa 🎁 çiziliyor;
               * düzen her hâlükârda hediye baloncuğu.
               */
              if (cozum) {
                const kod = katalogSatiri?.kod ?? null;
                /**
                 * OKUNMAMIŞ GELEN HEDİYE İLK GÖRÜŞTE OYNAR.
                 *
                 * Üç şart birden: mesaj bana geldi, sunucu okunmamış diyor ve
                 * bu oturumda daha önce oynamadı. Sonuncusu şart — ekran her
                 * yeniden render olduğunda (yeni mesaj, klavye açıldı,
                 * kaydırma) animasyon baştan başlamamalı.
                 */
                const anim = kod ? sceneFor(kod).anim?.() : undefined;
                const ilkGorus = !m.me && m.okundu === false && m.id != null && !oynayanlar.current.has(m.id);
                if (ilkGorus && m.id != null) oynayanlar.current.add(m.id);
                return (
                  <View key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                    <View style={styles.giftBubble}>
                      {/* Hediyeye dokunmak ÖNİZLEME açar — kullanıcı kararı:
                          "karşılık ver'e değil de hediyeye dokunursa
                          kendisine önizlemesi açılsın". */}
                      <Pressable
                        onPress={() => { haptic.light(); setOnizleme({ kod, ad: cozum.ad, emoji: katalogSatiri?.emoji || "🎁" }); }}
                        style={{ width: 62, height: 62, alignItems: "center", justifyContent: "center" }}
                      >
                        {ilkGorus && anim ? (
                          <Anim kaynak={anim} boyut={62} dongu={false} />
                        ) : png ? (
                          <Image source={png} style={{ width: 62, height: 62 }} contentFit="contain" transition={0} />
                        ) : (
                          <Txt size={42}>{katalogSatiri?.emoji || "🎁"}</Txt>
                        )}
                      </Pressable>

                      <View style={{ flexShrink: 1, gap: 3 }}>
                        {/* Hediyenin ADI geri geldi (kullanıcı istedi). */}
                        <Txt weight="extrabold" size={13} color="#fff" numberOfLines={1}>{cozum.ad}</Txt>
                        <Txt weight="displayBold" size={20} color={C.gold2} style={{ transform: [{ skewX: "-8deg" }] }}>
                          ×{cozum.adet}
                        </Txt>
                        {/*
                          Hediye kutusunu AYNI hediye seçili açar.

                          Önce yalnız GELEN hediyede çiziliyordu ("kendi
                          hediyene karşılık vermek anlamsız"). Ama kullanıcı
                          kendi gönderdiğine bakıp düğmeyi arayınca ortaya
                          çıktı ki orada da bir işe yarıyor: aynı hediyeyi
                          tekrar yollamak. İkisi de var, etiket duruma göre.
                        */}
                        <Pressable
                          onPress={() => { haptic.light(); setGiftSecim(kod); setGiftOpen(true); }}
                          hitSlop={6}
                          style={styles.karsilikBtn}
                        >
                          <Icon name="gift" size={12} color={C.gold2} />
                          <Txt weight="bold" size={11} color={C.gold2}>
                            {m.me ? "Tekrar gönder" : "Karşılık ver"}
                          </Txt>
                        </Pressable>
                      </View>
                    </View>
                    <Txt size={9} color={C.dim2} align="right" style={{ marginTop: 4 }}>{m.time}</Txt>
                  </View>
                );
              }
              return m.gift ? (
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
              );
            })}
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

      <GiftSheet
        visible={giftOpen}
        onClose={() => { setGiftOpen(false); setGiftSecim(null); }}
        // uid GEÇİLİYOR: eskiden yalnız isim vardı, hediye kutusu alıcıyı
        // tanımlayamıyordu. Henüz çözülmediyse `sendGift` peerUid'e düşer.
        recipients={[{ name: peer.name, uid: peerUid ?? undefined }]}
        baslangicKod={giftSecim}
        onSend={sendGift}
        onBakiyeYukle={() => { setGiftOpen(false); router.navigate("/wallet"); }}
      />

      {/* Hediye önizlemesi — profil vitrinindekiyle aynı: tam boy, temiz
          zemin, dokununca kapanır. Lottie'si olmayan hediye emojiyle. */}
      <CenterModal visible={!!onizleme} onClose={() => setOnizleme(null)}>
        {!!onizleme && (
          <Pressable onPress={() => setOnizleme(null)} style={{ alignItems: "center", paddingVertical: 10 }}>
            {(() => {
              const a = onizleme.kod ? sceneFor(onizleme.kod).anim?.() : undefined;
              const p = giftPng(onizleme.kod);
              if (a) return <Anim kaynak={a} boyut={220} />;
              if (p) return <Image source={p} style={{ width: 200, height: 200 }} contentFit="contain" />;
              return <Txt size={110}>{onizleme.emoji}</Txt>;
            })()}
            <Txt weight="displayBold" size={17} color="#fff" style={{ marginTop: 8 }}>{onizleme.ad}</Txt>
            <Txt size={11} color={C.dim2} style={{ marginTop: 6 }}>Kapatmak için dokun</Txt>
          </Pressable>
        )}
      </CenterModal>

      {/* Hata bildirimi. `setHata` yazılıyordu ama HİÇ ÇİZİLMİYORDU —
          gönderim başarısız olsa kullanıcı sebebini göremiyordu. */}
      {!!hata && (
        <Pressable onPress={() => setHata(null)} style={styles.hataToast}>
          <Txt weight="bold" size={12} color="#fff" align="center">{hata}</Txt>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hataToast: { position: "absolute", left: 24, right: 24, bottom: 96, backgroundColor: "rgba(15,13,21,.96)", borderWidth: 1, borderColor: "rgba(248,113,113,.5)", paddingVertical: 11, paddingHorizontal: 16, borderRadius: 14 },
  root: { flex: 1, backgroundColor: C.bg },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  bcHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  verify: { width: 15, height: 15, borderRadius: 8, backgroundColor: "#3B82F6", alignItems: "center", justifyContent: "center" },
  dateTag: { backgroundColor: C.kontrol, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: "hidden" },
  bcCard: { flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 18, borderTopLeftRadius: 6, padding: 14 },
  bcFoto: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.line, marginBottom: 9, backgroundColor: C.kart },
  csBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 15, borderRadius: 999 },
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 16 },
  bubbleThem: { alignSelf: "flex-start", maxWidth: "76%", backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderTopLeftRadius: 5 },
  // Yatay düzen: görsel + iri adet (odadaki hediye baloncuğuyla aynı dil).
  giftBubble: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 18, backgroundColor: C.kontrol, borderWidth: 1, borderColor: C.gold + "44" },
  karsilikBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 2, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.gold + "45", backgroundColor: C.gold + "14" },
  inputWrap: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, justifyContent: "center" },
  input: { color: C.text, fontSize: 12.5, fontFamily: "PlusJakartaSans_500Medium", paddingVertical: 11 },
  giftBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.gold + "44", backgroundColor: C.gold + "14", alignItems: "center", justifyContent: "center" },
  sendBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  blockBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginHorizontal: 16, marginTop: 8, marginBottom: 6, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.kart, borderWidth: 1, borderColor: C.line },
});
