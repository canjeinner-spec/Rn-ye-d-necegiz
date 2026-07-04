import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AgencyBadge } from "@/components/AgencyEmblem";
import { CenterModal } from "@/components/CenterModal";
import { PngBadge } from "@/components/PngBadge";
import { levelTierBadge } from "@/data/badges";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { DM_THREADS, type DMThread } from "@/data/dm";
import { type Gift } from "@/data/gifts";
import { block, getBlockState, unblock } from "@/data/remote/blockRepo";
import { getOrCreateConversation } from "@/data/remote/dmRepo";
import { follow, getFollowState, unfollow } from "@/data/remote/followRepo";
import { getPublicProfile, type PublicProfile } from "@/data/remote/profileRepo";
import { reportUserById } from "@/data/remote/reportRepo";
import { getVisitorCount, recordVisit } from "@/data/remote/visitRepo";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { FEATURES } from "@/lib/features";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { GiftSheet } from "@/sheets/GiftSheet";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const REPORT_REASONS: { ic: IconName; t: string }[] = [
  { ic: "ban", t: "Taciz veya zorbalık" },
  { ic: "adult", t: "Uygunsuz içerik" },
  { ic: "mask", t: "Sahte hesap" },
  { ic: "spam", t: "Spam" },
  { ic: "warn", t: "Dolandırıcılık" },
  { ic: "warn", t: "Diğer" },
];

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setActiveDM = useApp((s) => s.setActiveDM);
  const params = useLocalSearchParams<{ name?: string; lv?: string; publicId?: string }>();

  // publicId verilmişse gerçek profili DB'den yükle (yoksa mock parametreler).
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [followers, setFollowers] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured || !params.publicId) return;
    let alive = true;
    getPublicProfile(params.publicId).then((p) => {
      if (!alive) return;
      setProfile(p);
      if (p) {
        recordVisit(p.id).catch(() => {}); // ziyareti kaydet
        getFollowState(p.id).then((s) => {
          if (!alive) return;
          setFollowers(s.followers);
          setFollowingCount(s.following);
          setFollowing(s.isFollowing);
        }).catch(() => {});
        getVisitorCount(p.id).then((c) => { if (alive) setVisitorCount(c); }).catch(() => {});
        getBlockState(p.id).then((b) => { if (!alive) return; setBlocked(b.iBlocked); setBlockedByThem(b.blockedByThem); }).catch(() => {});
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [params.publicId]);

  const toggleFollow = () => {
    if (!profile) { setFollowing((f) => !f); return; } // mock fallback
    haptic.light();
    const next = !following;
    setFollowing(next);
    setFollowers((c) => Math.max(0, (c ?? 0) + (next ? 1 : -1)));
    (next ? follow(profile.id) : unfollow(profile.id)).catch((e) => {
      console.warn("[follow]", e?.code || "", e?.message || e);
      // geri al
      setFollowing(!next);
      setFollowers((c) => Math.max(0, (c ?? 0) + (next ? -1 : 1)));
    });
  };

  const name = profile?.kullanici_adi || params.name || "Kullanıcı";
  const lv = profile?.seviye_id ?? (Number(params.lv) || 28);
  const id = profile?.public_id || params.publicId || "1149663822";
  const photo = profile?.profil_resmi || undefined;
  const bio = profile?.biyografi || null;
  const gender = profile?.cinsiyet || null; // 'e' | 'k' | null
  const country = profile?.ulke || null;

  const [tab, setTab] = useState(0);
  const [friend, setFriend] = useState<"none" | "pending" | "friend">("none");
  const [following, setFollowing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [blocked, setBlocked] = useState(false); // ben onu engelledim
  const [blockedByThem, setBlockedByThem] = useState(false); // o beni engelledi
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addMsg, setAddMsg] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [repReason, setRepReason] = useState<string | null>(null);
  const [repDetail, setRepDetail] = useState("");
  const [repDone, setRepDone] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flash = (m: string) => { setToast(m); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(""), 1800); };

  const openDM = async () => {
    haptic.light();
    // Gerçek kullanıcı (DB profili) → konuşmayı bul/oluştur, gerçek DM aç
    if (isSupabaseConfigured && profile && useApp.getState().session) {
      try {
        const convId = await getOrCreateConversation(profile.id);
        setActiveDM({ id: convId, convId, name: profile.kullanici_adi, publicId: profile.public_id, photo: profile.profil_resmi || undefined, last: "", time: "", unread: 0, online: false });
        router.navigate("/dm-chat");
        return;
      } catch { /* hata → mock akışa düş */ }
    }
    const existing = DM_THREADS.find((d) => d.name === name);
    const thread: DMThread = existing || { id: Date.now(), name, last: "", time: "Şimdi", unread: 0, online: true };
    setActiveDM(thread);
    router.navigate("/dm-chat");
  };
  const copyId = () => { haptic.select(); setCopied(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1200); };
  const toggleBlock = () => {
    setMenu(false);
    haptic.medium();
    const next = !blocked;
    setBlocked(next);
    flash(next ? `${name} engellendi.` : `${name} engeli kaldırıldı.`);
    if (isSupabaseConfigured && profile) {
      (next ? block(profile.id) : unblock(profile.id)).catch((e) => {
        console.warn("[block]", e?.message || e);
        setBlocked(!next); // geri al
      });
    }
  };
  const sendRequest = () => { haptic.success(); setFriend("pending"); setAddOpen(false); setAddMsg(""); };
  const sendGift = (g: Gift, qty: number) => { haptic.success(); setGiftOpen(false); flash(`${g.name} ×${qty} gönderildi!`); };

  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          <View style={styles.cover}>
            <Scene kind="night" />
            <SafeAreaView edges={["top"]} style={styles.coverBar}>
              <Pressable onPress={() => router.back()} style={styles.coverBtn}>
                <Icon name="back" size={16} color="#fff" />
              </Pressable>
              <Pressable onPress={() => { haptic.light(); setMenu((m) => !m); }} style={styles.coverBtn}>
                <Icon name="dots" size={16} color="#fff" />
              </Pressable>
            </SafeAreaView>
          </View>

          <View style={{ alignItems: "center", marginTop: -46, paddingHorizontal: 18 }}>
            <Portrait name={name} size={92} ring={C.gold} glow frameBorder="#0A0A0F" photo={photo} />
            <Txt weight="displayBold" size={18} color="#fff" style={{ marginTop: 10 }}>{name}</Txt>
            {/* Rozet vitrini — tek satır, premium PNG set, gerçek boyutta */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <PngBadge name="role_vip" size={44} />
              <PngBadge name={levelTierBadge(lv)} size={44} />
              <AgencyBadge size={44} />
              <PngBadge name="role_streamer" size={44} />
            </View>
            <Pressable onPress={copyId} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Txt weight="semibold" size={11.5} color={C.dim}>ID: {id}</Txt>
              <Icon name="copy" size={12} color={C.dim2} />
              {copied && <Txt weight="bold" size={9.5} color={C.green}>Kopyalandı</Txt>}
            </Pressable>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 11, alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Txt weight="extrabold" size={12} color="#5EEAD4">LV.{lv}</Txt>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="male" size={14} color={gender === "k" ? "#FB7185" : "#60A5FA"} />
                <Txt weight="bold" size={12} color={gender === "k" ? "#FB7185" : "#60A5FA"}>{gender === "k" ? "Kadın" : "Erkek"}</Txt>
              </View>
              <Txt weight="bold" size={12} color="#6EE7B7">🇹🇷 {country || "Türkiye"}</Txt>
            </View>
            <Txt size={11.5} color={bio ? C.text : C.dim2} lh={1.5} align="center" style={{ marginTop: 12, paddingHorizontal: 20 }}>{bio || "Açıklama kısmı boş"}</Txt>
          </View>

          <View style={styles.stats}>
            {([[visitorCount != null ? String(visitorCount) : "—", "Ziyaretçiler"], [followingCount != null ? String(followingCount) : "—", "Takip Edilen"], [followers != null ? String(followers) : "—", "Takipçiler"]] as const).map(([n, l], i) => (
              <View key={l} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Txt weight="displayBold" size={18} color="#fff">{n}</Txt>
                  <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 3 }}>{l}</Txt>
                </View>
                {i < 2 && <View style={styles.statDivider} />}
              </View>
            ))}
          </View>

          <View style={styles.tabs}>
            {["İz", "Profil"].map((t, i) => {
              const on = i === tab;
              return (
                <Pressable key={t} onPress={() => { haptic.select(); setTab(i); }} style={styles.tab}>
                  <Txt weight={on ? "extrabold" : "semibold"} size={13} color={on ? C.gold : C.dim}>{t}</Txt>
                  {on && <View style={styles.tabUnderline} />}
                </Pressable>
              );
            })}
          </View>

          {tab === 0 ? (
            <View style={{ paddingHorizontal: 2 }}>
              <View style={styles.rowCard}>
                <Txt weight="extrabold" size={13.5} color={C.text}>Katıldığı Odalar</Txt>
                <View style={{ flex: 1 }} />
                <Txt weight="semibold" size={12} color={C.dim}>959 oda</Txt>
                <Icon name="chev" size={15} color={C.dim2} />
              </View>
              {/* MVP: Hediye bölümü gizli (FEATURES.profileGift) */}
              {FEATURES.profileGift && (
                <View style={{ padding: 16, paddingBottom: 0 }}>
                  <Txt weight="extrabold" size={13.5} color={C.text} style={{ marginBottom: 10 }}>Hediye</Txt>
                  <Pressable onPress={() => { haptic.light(); setGiftOpen(true); }} style={styles.giftCard}>
                    <View style={styles.giftIcon}>
                      <Icon name="crown" size={17} color={C.gold2} />
                    </View>
                    <Txt weight="extrabold" size={13} color="#fff">Hediye Sergi Salonu</Txt>
                    <View style={{ flex: 1 }} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Txt weight="extrabold" size={11.5} color={C.gold2}>Hediye Gönder</Txt>
                      <Icon name="chev" size={13} color={C.gold2} />
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: "row", marginTop: 12 }}>
                    <Txt size={11} color={C.dim}>Normal Hediyeler: </Txt>
                    <Txt weight="bold" size={11} color={C.text}>4.926</Txt>
                    <Txt size={11} color={C.dim}> toplandı</Txt>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={{ padding: 18 }}>
              <Txt size={12.5} color={C.dim} lh={1.6}>Bu kullanıcı henüz profil bilgisi eklememiş.</Txt>
            </View>
          )}
        </ScrollView>

        {menu && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
            <Animated.View entering={FadeIn} style={[styles.menu, { top: insets.top + 44 }]}>
              <Pressable onPress={toggleBlock} style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: C.line }]}>
                <Icon name="blockuser" size={15} color="#FB7185" />
                <Txt weight="bold" size={12.5} color="#FB7185">{blocked ? "Engeli Kaldır" : "Engelle"}</Txt>
              </Pressable>
              <Pressable onPress={() => { setMenu(false); setReportOpen(true); }} style={styles.menuItem}>
                <Icon name="flag" size={15} color="#FB7185" />
                <Txt weight="bold" size={12.5} color="#FB7185">Raporla</Txt>
              </Pressable>
            </Animated.View>
          </>
        )}

        <View style={[styles.actionBar, { paddingBottom: 14 + insets.bottom }]}>
          {blockedByThem ? (
            // Karşı taraf engellemiş → salt bilgilendirme (tek satır)
            <View style={styles.blockNotice}>
              <Icon name="blockuser" size={15} color={C.dim} />
              <Txt weight="bold" size={12.5} color={C.dim} numberOfLines={1} style={{ flexShrink: 1 }}>Bu kişi sizi engelledi</Txt>
            </View>
          ) : blocked ? (
            // Ben engellemişim → tek tam-genişlik "Engeli Kaldır"
            <Pressable onPress={toggleBlock} style={styles.unblockBtn}>
              <Icon name="blockuser" size={16} color="#FB7185" />
              <Txt weight="extrabold" size={13} color="#FB7185">Engeli Kaldır</Txt>
            </Pressable>
          ) : (
            <>
              {friend === "none" ? (
                <Pressable onPress={() => { haptic.light(); setAddOpen(true); }} style={styles.barBtn}>
                  <Icon name="userAdd" size={17} color={C.text} />
                  <Txt weight="bold" size={12} color={C.text}>Arkadaş Ekle</Txt>
                </Pressable>
              ) : friend === "pending" ? (
                <View style={[styles.barBtn, { opacity: 0.6 }]}>
                  <Icon name="check" size={16} color={C.gold} />
                  <Txt weight="bold" size={12} color={C.gold2}>İstek Gönderildi</Txt>
                </View>
              ) : (
                <View style={styles.barBtn}>
                  <Icon name="check" size={16} color={C.green} sw={3} />
                  <Txt weight="bold" size={12} color="#6EE7B7">Arkadaşsınız</Txt>
                </View>
              )}
              <Pressable onPress={openDM} style={styles.barBtn}>
                <Icon name="chat" size={16} color={C.text} />
                <Txt weight="bold" size={12} color={C.text}>Mesaj</Txt>
              </Pressable>
              <Pressable onPress={toggleFollow} style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}>
                {following ? (
                  <View style={[styles.barBtn, { width: "100%" }]}>
                    <Icon name="check" size={16} color={C.text} sw={2.5} />
                    <Txt weight="bold" size={12} color={C.text}>Takiptesin</Txt>
                  </View>
                ) : (
                  <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.barBtnPrimary}>
                    <Icon name="heart" size={16} color="#241A05" />
                    <Txt weight="extrabold" size={12} color="#241A05">Takip Et</Txt>
                  </Gradient>
                )}
              </Pressable>
            </>
          )}
        </View>

        {!!toast && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.toast, { bottom: 96 + insets.bottom }]}>
            <Txt weight="bold" size={12} color="#fff">{toast}</Txt>
          </Animated.View>
        )}
      </View>

      <CenterModal visible={addOpen} onClose={() => setAddOpen(false)}>
        <View style={styles.dialog}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Txt weight="displayBold" size={16.5} color="#fff">Arkadaşlık İsteği</Txt>
            <Pressable onPress={() => setAddOpen(false)}><Icon name="x" size={17} color={C.dim} /></Pressable>
          </View>
          <Txt size={11.5} color={C.dim} lh={1.5} style={{ marginBottom: 14 }}>{name} kişisine kısa bir not ekle.</Txt>
          <View style={styles.addInput}>
            <TextInput autoFocus value={addMsg} onChangeText={setAddMsg} maxLength={60} placeholder="Selam, tanışalım mı?" placeholderTextColor={C.dim2} style={{ flex: 1, color: C.text, fontSize: 13, padding: 0 }} />
            {!!addMsg && <Pressable onPress={() => setAddMsg("")}><Icon name="x" size={14} color={C.dim2} /></Pressable>}
          </View>
          <Pressable onPress={sendRequest} style={{ marginTop: 16, borderRadius: 14, overflow: "hidden" }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.dialogBtn}>
              <Txt weight="extrabold" size={13.5} color="#241A05">Gönder</Txt>
            </Gradient>
          </Pressable>
        </View>
      </CenterModal>

      <CenterModal visible={reportOpen} onClose={() => { setReportOpen(false); setRepReason(null); setRepDone(false); setRepDetail(""); }}>
        <View style={styles.dialog}>
          {repDone ? (
            <View style={{ alignItems: "center" }}>
              <Gradient colors={[C.green, "#059669"]} deg={135} style={styles.successIcon}>
                <Icon name="check" size={28} sw={3} color="#04231A" />
              </Gradient>
              <Txt weight="displayBold" size={16} color="#fff">Rapor Gönderildi</Txt>
              <Txt size={11.5} color={C.dim} align="center" style={{ marginTop: 8 }}>Ekibimiz en kısa sürede inceleyecek.</Txt>
              <Pressable onPress={() => { setReportOpen(false); setRepReason(null); setRepDone(false); setRepDetail(""); }} style={{ alignSelf: "stretch", marginTop: 18, borderRadius: 14, overflow: "hidden" }}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.dialogBtn}>
                  <Txt weight="extrabold" size={13} color="#241A05">Kapat</Txt>
                </Gradient>
              </Pressable>
            </View>
          ) : (
            <>
              <Txt weight="displayBold" size={16} color="#fff" style={{ marginBottom: 4 }}>{name} kullanıcısını raporla</Txt>
              <Txt size={11.5} color={C.dim} style={{ marginBottom: 14 }}>Neden raporluyorsun?</Txt>
              {REPORT_REASONS.map((r) => {
                const on = repReason === r.t;
                return (
                  <Pressable key={r.t} onPress={() => { haptic.select(); setRepReason(r.t); }} style={[styles.reason, { backgroundColor: on ? `${C.red}12` : C.card, borderColor: on ? C.red : C.line }]}>
                    <View style={styles.reasonIcon}>
                      <Icon name={r.ic} size={16} color="#FB7185" />
                    </View>
                    <Txt weight="bold" size={12.5} color={on ? C.red : C.text} style={{ flex: 1 }}>{r.t}</Txt>
                    {on && <Icon name="check" size={15} color={C.red} sw={3} />}
                  </Pressable>
                );
              })}
              {repReason && (
                <>
                  <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.4, marginTop: 6, marginBottom: 7 }}>DETAY (opsiyonel)</Txt>
                  <TextInput value={repDetail} onChangeText={setRepDetail} multiline maxLength={300} placeholder={`${name} hakkında daha fazla bilgi ver...`} placeholderTextColor={C.dim2} style={styles.detailInput} />
                  <Pressable
                    onPress={() => {
                      haptic.success();
                      setRepDone(true);
                      if (isSupabaseConfigured && profile && repReason) {
                        reportUserById(profile.id, repReason, repDetail).catch(() => flash("Rapor gönderilemedi"));
                      }
                    }}
                    style={{ marginTop: 12, borderRadius: 14, overflow: "hidden" }}
                  >
                    <Gradient colors={["#DC2626", "#7F1D1D"]} deg={135} style={styles.dialogBtn}>
                      <Txt weight="extrabold" size={13} color="#FEE2E2">Raporu Gönder</Txt>
                    </Gradient>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </CenterModal>

      <GiftSheet visible={giftOpen} onClose={() => setGiftOpen(false)} recipients={[{ name, muted: false, lv }]} coins={860} onSend={sendGift} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0F" },
  cover: { height: 150, position: "relative" },
  coverBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
  coverBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,.35)", alignItems: "center", justifyContent: "center", marginTop: 10 },
  stats: { flexDirection: "row", marginTop: 18, paddingVertical: 16, paddingHorizontal: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,.08)" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.07)" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 13 },
  tabUnderline: { position: "absolute", bottom: 0, width: 30, height: 2.5, borderRadius: 3, backgroundColor: C.gold },
  rowCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)" },
  giftCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, backgroundColor: "rgba(124,58,237,.12)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  giftIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}40`, marginRight: 11 },
  menu: { position: "absolute", right: 14, borderRadius: 14, overflow: "hidden", minWidth: 150, backgroundColor: "#1C1A24", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 12, backgroundColor: "rgba(10,10,15,.95)" },
  barBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.13)" },
  barBtnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14 },
  blockNotice: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: C.line },
  unblockBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: "rgba(251,113,133,.10)", borderWidth: 1, borderColor: "rgba(251,113,133,.30)" },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: `${C.red}55`, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  dialog: { borderRadius: 24, padding: 20, backgroundColor: "#181620", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  addInput: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  dialogBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  successIcon: { width: 56, height: 56, borderRadius: 28, marginBottom: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.green },
  reason: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 13, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  reasonIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.12)", borderWidth: 1, borderColor: "rgba(251,113,133,.25)" },
  detailInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, color: C.text, fontSize: 12.5, height: 84, textAlignVertical: "top" },
});
