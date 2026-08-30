import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthorityTag } from "@/components/AuthorityTag";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { MenuIcon } from "@/components/MenuIcon";
import { OzelIdGosterim } from "@/components/OzelId";
import { OzelIdInfoModal } from "@/components/OzelIdInfoModal";
import { PngBadge } from "@/components/PngBadge";
import { FramePreview } from "@/components/FramePreview";
import { Portrait } from "@/components/Portrait";
import { TileIcon, type TileType } from "@/components/TileIcon";
import { Txt } from "@/components/Txt";
import { levelTierBadge } from "@/data/badges";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { getFollowCounts } from "@/data/remote/followRepo";
import { EquippedBadge } from "@/components/EquippedBadge";
import { KopyaBtn } from "@/components/KopyaBtn";
import { getUserBadges, type KazanilmisRozet } from "@/data/remote/badgeRepo";
import { getVisitorCount } from "@/data/remote/visitRepo";
import { updateMyProfile } from "@/data/remote/profileRepo";
import { getCached, setCached, useCachedResource } from "@/lib/cache";
import { getMyBalance } from "@/data/remote/walletRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { FEATURES } from "@/lib/features";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { CouponSheet } from "@/sheets/CouponSheet";
import { EditProfileSheet } from "@/sheets/EditProfileSheet";
import { ProfileInfoSheet, type InfoMode } from "@/sheets/ProfileInfoSheet";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type MenuItem = { ic: IconName; g1: string; g2: string; t: string; s?: string; r?: string; onPress: () => void };


export default function ProfileTab() {
  const router = useRouter();
  const [ozelIdInfo, setOzelIdInfo] = useState(false);
  const { userName, userBio, userPhoto, userLevel, setUserPhoto, isStreamer, betaTester, ozelId, ozelIdTip, ozelIdTema, kusanilanRozet, kusanili, role, hideProfile, setHideProfile, publicId, dbId, loadProfile, session } = useApp();

  // Cache-first sayaçlar: son bilinen değeri ANINDA göster (persist), arkada tazele.
  const { data: followCounts } = useCachedResource<{ followers: number; following: number }>(
    `follow:${dbId ?? "?"}`, () => getFollowCounts(dbId as number), { persist: true, enabled: !!session && !!dbId },
  );
  const { data: visitorCount } = useCachedResource<number>(
    `visitors:${dbId ?? "?"}`, () => getVisitorCount(dbId as number), { persist: true, enabled: !!session && !!dbId },
  );

  // Ekrana her gelişte profili tazele (store'dan zaten anında render ediliyor).
  useFocusEffect(useCallback(() => { if (session) loadProfile(); }, [session, loadProfile]));

  // Cüzdan satırındaki bakiye. Eskiden "12.4K" ve "860" sabit yazıyordu —
  // cüzdan ekranıyla aynı önbelleği kullanır, aynı sayıyı gösterir.
  const [bal, setBal] = useState<{ elmas: number; altin: number }>(() => getCached("wallet:bal") ?? { elmas: 0, altin: 0 });
  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured || !session) return;
      let alive = true;
      getMyBalance().then((b) => { if (alive) { setBal(b); setCached("wallet:bal", b, true); } }).catch(() => {});
      return () => { alive = false; };
    }, [session]),
  );

  // Menüdeki "Rozetlerim" alt metni — gerçek sayı (049 rozet sistemi).
  const { data: rozetler } = useCachedResource<KazanilmisRozet[]>(
    `rozet:${dbId ?? "?"}`, () => getUserBadges(dbId as number), { persist: true, enabled: !!session && !!dbId },
  );
  // Rol rozetleri yetkiden gelir, koleksiyonda gösterilmiyor — sayaca da girmez.
  const rozetSayisi = rozetler?.filter((r) => r.kategori !== "role").length ?? 0;
  const rozetOzet = rozetSayisi ? `${rozetSayisi} rozet kazandın` : "Rozet koleksiyonunu gör";
  const [lang, setLang] = useState("Türkçe");
  const privileged = role !== "user";
  const [editOpen, setEditOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [info, setInfo] = useState<InfoMode | null>(null);

  const goMyRoom = () => { haptic.light(); router.navigate("/my-room"); };
  const openSheet = (fn: () => void) => () => { haptic.light(); fn(); };

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
    if (res.canceled) return;
    const a = res.assets[0];
    setUserPhoto(a.uri); // anlık yerel önizleme
    // Yalnızca Storage'a yüklenen https URL'i DB'ye yaz; file:// ASLA kaydedilmez
    // (yoksa diğer cihazlar/kullanıcılar göremez).
    if (isSupabaseConfigured && useApp.getState().session && a.base64) {
      try {
        const url = await uploadAvatar(a.base64, a.uri);
        setUserPhoto(url);
        await updateMyProfile({ profil_resmi: url });
      } catch { /* yükleme başarısızsa yerel önizleme kalır, DB'ye yazılmaz */ }
    }
  };

  const tiles: { type: TileType; lbl: string; onPress: () => void }[] = [
    { type: "tasks", lbl: "Görevler", onPress: () => { haptic.light(); router.navigate("/tasks"); } },
    ...(FEATURES.store ? [{ type: "store" as TileType, lbl: "Mağaza", onPress: () => { haptic.light(); router.navigate("/store"); } }] : []),
    ...(FEATURES.inventory ? [{ type: "items" as TileType, lbl: "Eşyalarım", onPress: () => { haptic.light(); router.navigate("/inventory"); } }] : []),
    { type: "level", lbl: "Level", onPress: () => { haptic.light(); router.navigate("/level"); } },
  ];

  const menu: MenuItem[] = [
    // Yalnızca yetkili hesaplar (developer / super_admin) görür
    ...(role !== "user" ? [{ ic: "gear" as IconName, g1: "#F5CE6E", g2: "#B45309", t: "Yönetim", s: "Raporlar ve kullanıcı işlemleri", onPress: () => { haptic.light(); router.navigate("/admin"); } }] : []),
    { ic: "mic", g1: "#C8A24A", g2: "#7A5A16", t: "Odam", s: "Kendi sesli sohbet odanı aç", onPress: goMyRoom },
    ...(FEATURES.vip ? [{ ic: "crown" as IconName, g1: "#F5CE6E", g2: "#B45309", t: "Aron VIP", s: "Özel ayrıcalıkların kilidini aç", onPress: () => { haptic.light(); router.navigate("/vip"); } }] : []),
    // Yayıncı Paneli `isStreamer` ile kapalıydı; o bayrak DB'den HİÇ
    // gelmiyor (kullanicilar tablosunda yayıncı kolonu yok), store'da sabit
    // false duruyordu — yani giriş kimseye görünmüyordu. Bayrak gelene kadar
    // girişi herkese açıyoruz.
    ...(FEATURES.streamerPanel ? [{ ic: "mic" as IconName, g1: "#F5CE6E", g2: "#B45309", t: "Yayıncı Paneli", s: "Kazancını ve ajansını yönet", onPress: () => { haptic.light(); router.navigate("/agency-panel"); } }] : []),
    ...(FEATURES.giftHistory ? [{ ic: "gift" as IconName, g1: "#EC4899", g2: "#BE185D", t: "Hediye Geçmişi", s: "Gönderdiğin & aldığın hediyeler", onPress: () => { haptic.light(); router.navigate("/gift-history"); } }] : []),
    { ic: "userAdd", g1: "#34D399", g2: "#0F6B4B", t: "Arkadaşını Davet Et", s: "Davet et, beraber elmas kazanın", onPress: () => { haptic.light(); router.navigate("/referral"); } },
    { ic: "trophy", g1: "#F5CE6E", g2: "#8A5E12", t: "Rozetlerim", s: rozetOzet, onPress: () => { haptic.light(); router.navigate("/badges"); } },
    { ic: "idcard", g1: "#F5CE6E", g2: "#B45309", t: "Özel ID", s: "Prestijli kısa ID'leri keşfet", onPress: () => { haptic.light(); router.navigate("/special-id"); } },
    ...(FEATURES.giftCoupon ? [{ ic: "ticket" as IconName, g1: "#06B6D4", g2: "#0891B2", t: "Hediye Kuponu Gir", s: "Kodunu gir, ödülünü al", onPress: openSheet(() => setCouponOpen(true)) }] : []),
  ];

  const settings: MenuItem[] = [
    { ic: "chat", g1: "#5B6474", g2: "#333A46", t: "Müşteri Hizmetleri & SSS", onPress: () => { haptic.light(); router.navigate("/support"); } },
    { ic: "shield", g1: "#5B6474", g2: "#333A46", t: "Hesap & Güvenlik", onPress: () => { haptic.light(); router.navigate("/security"); } },
  ];

  const renderMenu = (items: MenuItem[]) => (
    <View style={styles.menuGroup}>
      {items.map((m) => (
        <Pressable key={m.t} onPress={m.onPress} style={styles.menuRow}>
          <MenuIcon icon={m.ic} g1={m.g1} g2={m.g2} size={32} />
          <View style={{ flex: 1 }}>
            <Txt weight="extrabold" size={m.s ? 13 : 12.5} color={C.text}>{m.t}</Txt>
            {m.s && <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>{m.s}</Txt>}
          </View>
          {m.r && <Txt weight="semibold" size={11} color={m.r === "⚠️" ? C.gold : C.dim}>{m.r}</Txt>}
          <Icon name="chev" size={14} color={C.dim2} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Kapak — mor/kahve karışımı yerine temanın siyah-altını: karanlık
            zemin + köşede altın hale + alt kenarda ince altın çizgi. */}
        <View style={styles.cover}>
          <Gradient colors={["#1B1626", "#12101A", "#08080C"]} deg={165} style={StyleSheet.absoluteFill} />
          <Gradient colors={[C.gold + "2E", "transparent"]} deg={155} style={styles.coverGlow} pointerEvents="none" />
          <SafeAreaView edges={["top"]}>
            <View style={{ height: 40 }} />
          </SafeAreaView>
          <Pressable onPress={openSheet(() => setEditOpen(true))} style={styles.editBtn}>
            <Icon name="edit" size={15} color={C.gold} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 14, marginTop: -36 }}>
            <Pressable onPress={pickAvatar}>
              {/* Kuşanılan çerçeve (056) burada gerçekten çiziliyor —
                  mağazadan alıp kuşandığın şey profilinde görünür. */}
              <View style={{ width: 84, height: 84 }}>
                <Portrait name="Sen" size={84} ring={kusanili.cerceve ? "transparent" : C.gold} glow={!kusanili.cerceve} online frameBorder="#08080C" photo={userPhoto || undefined} />
                {kusanili.cerceve && <FramePreview id={kusanili.cerceve} size={84} />}
              </View>
              <View style={styles.camBadge}>
                <Icon name="camera" size={14} sw={2} color="#241A05" />
              </View>
            </Pressable>
            <View style={{ paddingBottom: 6, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <Txt weight="displayBold" size={19} color="#fff">{userName}</Txt>
                {privileged && <AuthorityTag />}
                {hideProfile && (
                  <View style={styles.hiddenPill}>
                    <Icon name="eye" size={11} color={C.gold2} />
                    <Txt weight="extrabold" size={9} color={C.gold2}>Gizli</Txt>
                  </View>
                )}
              </View>
              {ozelId && ozelIdTip && ozelIdTema ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Pressable onPress={() => { haptic.light(); setOzelIdInfo(true); }}>
                    <OzelIdGosterim id={ozelId} tip={ozelIdTip} tema={ozelIdTema} premiumWidth={88} kapsulSize={8} />
                  </Pressable>
                  <KopyaBtn deger={ozelId} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                  <Txt weight="semibold" size={10.5} color={C.dim}>ID: {publicId || "—"}</Txt>
                  <KopyaBtn deger={publicId} />
                </View>
              )}
            </View>
            {/* Kendi profilini herkese göründüğü gibi (public) önizle */}
            <Pressable
              onPress={() => { haptic.light(); router.navigate(`/user-profile?self=1${publicId ? `&publicId=${encodeURIComponent(publicId)}` : ""}&name=${encodeURIComponent(userName)}`); }}
              hitSlop={10}
              style={{ alignSelf: "center", paddingLeft: 4 }}
            >
              <Icon name="chev" size={22} color={C.dim} />
            </Pressable>
          </View>

          {/* Rozet vitrini — tek satır, premium PNG set, eski SVG boyutunda */}
          <View style={styles.premiumRow}>
            {role === "developer" && <PngBadge name="role_developer" size={28} />}
            {role === "super_admin" && <PngBadge name="role_super_admin" size={28} />}
            <PngBadge name="role_vip" size={28} />
            <PngBadge name={levelTierBadge(userLevel)} size={28} />
            {isStreamer && <PngBadge name="role_streamer" size={28} />}
            {betaTester && <PngBadge name="special_beta_tester" size={28} />}
            {/* Kuşanılan rozet — kullanıcının koleksiyondan seçtiği */}
            <EquippedBadge kod={kusanilanRozet} size={28} />
          </View>

          {/* Beta Tester hakkı: kapsül kimliğini henüz almadıysa yönlendir (alınca kaybolur) */}
          {betaTester && !ozelId && (
            <Pressable onPress={() => { haptic.light(); router.navigate("/special-id"); }} style={styles.kapsulHatirlat}>
              <View style={styles.kapsulIkon}>
                <Icon name="idcard" size={14} color={C.gold2} />
              </View>
              <Txt weight="semibold" size={11} color={C.gold2} style={{ flex: 1 }} lh={1.4}>
                Beta Tester olarak ücretsiz <Txt weight="extrabold" size={11} color={C.gold2}>Kapsül Kimlik</Txt> hakkın var. Almak için dokun.
              </Txt>
              <Icon name="chev" size={16} color={C.gold2} />
            </Pressable>
          )}

          {!!userBio && <Txt size={12} color={C.dim} lh={1.5} style={{ marginTop: 10 }}>{userBio}</Txt>}

          {/* Sayaçlar boşlukta duruyordu; artık ayırıcılı tek cam şerit. */}
          <View style={styles.statStrip}>
            {([["Ziyaretçi", visitorCount != null ? String(visitorCount) : "—", () => { haptic.light(); router.navigate("/visitors"); }], ["Takip", followCounts ? String(followCounts.following) : "—", undefined], ["Takipçi", followCounts ? String(followCounts.followers) : "—", undefined]] as const).map(([l, v, fn], i) => (
              <View key={l} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                <Pressable onPress={fn} style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}>
                  <Txt weight="displayBold" size={17} color={C.text}>{v}</Txt>
                  <Txt weight="semibold" size={9.5} color={C.dim2} style={{ marginTop: 3, letterSpacing: 0.3 }}>{l.toUpperCase()}</Txt>
                </Pressable>
                {i < 2 && <View style={styles.statDivider} />}
              </View>
            ))}
          </View>

          <View style={styles.tileRow}>
            {tiles.map((t) => (
              <Pressable key={t.type} onPress={t.onPress} style={{ flex: 1, alignItems: "center", gap: 7 }}>
                <TileIcon type={t.type} size={50} />
                <Txt weight="bold" size={11} color={C.text}>{t.lbl}</Txt>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => { haptic.light(); router.navigate("/wallet"); }} style={styles.wallet}>
            <Gradient colors={[C.gold + "16", "transparent"]} deg={120} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.walletIcon}>
              <Icon name="wallet" size={17} color={C.gold2} />
            </View>
            <Txt weight="displayBold" size={14.5} color={C.text}>Cüzdan</Txt>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <DiamondBadge size={16} />
              <Txt weight="extrabold" size={13.5} color="#22D3EE">{bal.elmas.toLocaleString("tr-TR")}</Txt>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 14 }}>
              <CoinBadge size={16} />
              <Txt weight="extrabold" size={13.5} color={C.gold2}>{bal.altin.toLocaleString("tr-TR")}</Txt>
            </View>
            <Icon name="chev" size={15} color={C.dim2} />
          </Pressable>

          {privileged && (
            <Pressable onPress={() => { haptic.light(); setHideProfile(!hideProfile); }} style={styles.streamerToggle}>
              <Icon name="eye" size={15} color={hideProfile ? C.gold2 : C.dim} />
              <Txt weight="semibold" size={11} color={C.dim} style={{ flex: 1 }}>Profili gizle (yetkili)</Txt>
              <View style={[styles.toggle, { backgroundColor: hideProfile ? C.gold : "rgba(255,255,255,.12)", alignItems: hideProfile ? "flex-end" : "flex-start" }]}>
                <View style={styles.knob} />
              </View>
            </Pressable>
          )}

          {renderMenu(menu)}
          {renderMenu(settings)}
        </View>
      </ScrollView>

      <EditProfileSheet visible={editOpen} onClose={() => setEditOpen(false)} />
      <CouponSheet visible={couponOpen} onClose={() => setCouponOpen(false)} />
      <ProfileInfoSheet visible={info !== null} mode={info ?? "lang"} lang={lang} setLang={setLang} onClose={() => setInfo(null)} />
      {ozelId && ozelIdTip && ozelIdTema && (
        <OzelIdInfoModal
          visible={ozelIdInfo}
          onClose={() => setOzelIdInfo(false)}
          id={ozelId}
          tip={ozelIdTip}
          tema={ozelIdTema}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  cover: { height: 104, position: "relative", overflow: "hidden" },
  coverGlow: { position: "absolute", right: -60, top: -70, width: 230, height: 200, borderRadius: 115 },
  statStrip: { flexDirection: "row", alignItems: "center", marginTop: 16, borderRadius: 18, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: "rgba(255,255,255,.12)" },
  walletIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "3D", marginRight: 11 },
  kapsulIkon: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1F", borderWidth: 1, borderColor: C.gold + "44" },
  editBtn: { position: "absolute", right: 14, bottom: 12, width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(0,0,0,.3)", alignItems: "center", justifyContent: "center" },
  camBadge: { position: "absolute", right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: C.gold2, borderWidth: 2.5, borderColor: "#08080C", alignItems: "center", justifyContent: "center" },
  premiumRow: { flexDirection: "row", gap: 6, marginTop: 12, alignItems: "center", flexWrap: "wrap" },
  tileRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", borderRadius: 20, paddingVertical: 16, paddingHorizontal: 8 },
  wallet: { flexDirection: "row", alignItems: "center", marginTop: 12, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: C.gold + "2E", borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, overflow: "hidden" },
  streamerToggle: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderStyle: "dashed", borderColor: C.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  kapsulHatirlat: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12, backgroundColor: "rgba(245,206,110,.08)", borderWidth: 1, borderColor: "rgba(232,179,65,.4)", borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13 },
  hiddenPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "44", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  toggle: { width: 38, height: 22, borderRadius: 999, padding: 2, justifyContent: "center" },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  menuGroup: { marginTop: 12, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", borderRadius: 20, padding: 6 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12 },
});
