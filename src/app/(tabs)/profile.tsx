import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BadgeRow } from "@/components/BadgeRow";
import { AuthorityTag } from "@/components/AuthorityTag";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { MenuIcon } from "@/components/MenuIcon";
import { Pill } from "@/components/Pill";
import { Portrait } from "@/components/Portrait";
import { TileIcon, type TileType } from "@/components/TileIcon";
import { Txt } from "@/components/Txt";
import { type BadgeItem } from "@/data/badges";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { getFollowCounts } from "@/data/remote/followRepo";
import { getVisitorCount } from "@/data/remote/visitRepo";
import { updateMyProfile } from "@/data/remote/profileRepo";
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
  const { userName, userBio, userPhoto, userLevel, setUserPhoto, isStreamer, setStreamer, role, setRole, hideProfile, setHideProfile, publicId, dbId, loadProfile, session } = useApp();
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  // Ekrana her gelişte profili + takip/ziyaret sayaçlarını DB'den tazele.
  useFocusEffect(useCallback(() => {
    if (!session) return;
    loadProfile();
    if (dbId) {
      getFollowCounts(dbId).then(setFollowCounts).catch(() => {});
      getVisitorCount(dbId).then(setVisitorCount).catch(() => {});
    }
  }, [session, loadProfile, dbId]));
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

  const badges: BadgeItem[] = [
    ...(role === "super_admin" ? [{ type: "super_admin" as const }] : role === "developer" ? [{ type: "developer" as const }] : []),
    { type: "vip" },
    { type: "level", lvl: userLevel },
    { type: "agency", meta: { id: "1", name: "Aron Stars", owner: "Ardaowski" } },
    ...(isStreamer ? [{ type: "streamer" as const }] : []),
  ];

  const tiles: { type: TileType; lbl: string; onPress: () => void }[] = [
    { type: "tasks", lbl: "Görevler", onPress: () => { haptic.light(); router.navigate("/tasks"); } },
    // MVP: Mağaza tile'ı gizli (FEATURES.store)
    ...(FEATURES.store ? [{ type: "store" as TileType, lbl: "Mağaza", onPress: () => { haptic.light(); router.navigate("/store"); } }] : []),
    // MVP: Eşyalarım (envanter) tile'ı gizli (FEATURES.inventory)
    ...(FEATURES.inventory ? [{ type: "items" as TileType, lbl: "Eşyalarım", onPress: () => { haptic.light(); router.navigate("/inventory"); } }] : []),
    { type: "level", lbl: "Level", onPress: () => { haptic.light(); router.navigate("/level"); } },
  ];

  const menu: MenuItem[] = [
    // Yalnızca yetkili hesaplar (developer / super_admin) görür
    ...(role !== "user" ? [{ ic: "gear" as IconName, g1: "#F5CE6E", g2: "#B45309", t: "Yönetim", s: "Raporlar ve kullanıcı işlemleri", onPress: () => { haptic.light(); router.navigate("/admin"); } }] : []),
    { ic: "mic", g1: "#A855F7", g2: "#6D28D9", t: "Odam", s: "Kendi sesli sohbet odanı aç", onPress: goMyRoom },
    // MVP: Aron VIP gizli (FEATURES.vip)
    ...(FEATURES.vip ? [{ ic: "crown" as IconName, g1: "#F5CE6E", g2: "#B45309", t: "Aron VIP", s: "Özel ayrıcalıkların kilidini aç", onPress: () => { haptic.light(); router.navigate("/vip"); } }] : []),
    // MVP: Yayıncı Paneli (yayıncı merkezi) gizli (FEATURES.streamerPanel)
    ...(isStreamer && FEATURES.streamerPanel ? [{ ic: "mic" as IconName, g1: "#34D399", g2: "#059669", t: "Yayıncı Paneli", s: "Kazancını ve ajansını yönet", onPress: () => { haptic.light(); router.navigate("/agency-panel"); } }] : []),
    // MVP: Hediye Geçmişi gizli (FEATURES.giftHistory)
    ...(FEATURES.giftHistory ? [{ ic: "gift" as IconName, g1: "#EC4899", g2: "#BE185D", t: "Hediye Geçmişi", s: "Gönderdiğin & aldığın hediyeler", onPress: () => { haptic.light(); router.navigate("/gift-history"); } }] : []),
    { ic: "userAdd", g1: "#34D399", g2: "#059669", t: "Arkadaşını Davet Et", s: "Davet et, beraber elmas kazanın", onPress: () => { haptic.light(); router.navigate("/referral"); } },
    { ic: "flag", g1: "#A855F7", g2: "#7C3AED", t: "Rozetlerim", s: "8 rozet kazandın", onPress: openSheet(() => setInfo("badges")) },
    { ic: "idcard", g1: "#F5CE6E", g2: "#B45309", t: "Özel ID", s: "Prestijli kısa ID'leri keşfet", onPress: () => { haptic.light(); router.navigate("/special-id"); } },
    // MVP: Hediye Kuponu Gir gizli (FEATURES.giftCoupon)
    ...(FEATURES.giftCoupon ? [{ ic: "ticket" as IconName, g1: "#06B6D4", g2: "#0891B2", t: "Hediye Kuponu Gir", s: "Kodunu gir, ödülünü al", onPress: openSheet(() => setCouponOpen(true)) }] : []),
  ];

  const settings: MenuItem[] = [
    { ic: "chat", g1: "#64748B", g2: "#475569", t: "Müşteri Hizmetleri & SSS", onPress: () => { haptic.light(); router.navigate("/support"); } },
    { ic: "gear", g1: "#475569", g2: "#334155", t: "Hesap & Güvenlik", r: "⚠️", onPress: () => { haptic.light(); router.navigate("/security"); } },
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
        <Gradient colors={["#1E1530", "#241B0A"]} deg={140} style={styles.cover}>
          <SafeAreaView edges={["top"]}>
            <View style={{ height: 40 }} />
          </SafeAreaView>
          <Pressable onPress={openSheet(() => setEditOpen(true))} style={styles.editBtn}>
            <Icon name="edit" size={15} color={C.gold} />
          </Pressable>
        </Gradient>

        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 14, marginTop: -36 }}>
            <Pressable onPress={pickAvatar}>
              <Portrait name="Sen" size={84} ring={C.gold} glow online frameBorder="#08080C" photo={userPhoto || undefined} />
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                <Txt weight="semibold" size={10.5} color={C.dim}>ID: {publicId || "—"}</Txt>
                <Icon name="copy" size={12} color={C.dim2} />
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 7, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <BadgeRow size={28} badges={badges} />
            <Pill bg="rgba(255,255,255,.05)" color={C.dim} border={C.line}>🇹🇷 Türkiye</Pill>
          </View>

          {!!userBio && <Txt size={12} color={C.dim} lh={1.5} style={{ marginTop: 10 }}>{userBio}</Txt>}

          <View style={{ flexDirection: "row", marginTop: 16 }}>
            {([["Ziyaretçi", visitorCount != null ? String(visitorCount) : "—", () => { haptic.light(); router.navigate("/visitors"); }], ["Takip", followCounts ? String(followCounts.following) : "—", undefined], ["Takipçi", followCounts ? String(followCounts.followers) : "—", undefined]] as const).map(([l, v, fn]) => (
              <Pressable key={l} onPress={fn} style={{ flex: 1, alignItems: "center" }}>
                <Txt weight="displayBold" size={17} color={C.text}>{v}</Txt>
                <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 2 }}>{l}</Txt>
              </Pressable>
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

          <Pressable onPress={() => router.navigate("/wallet")} style={styles.wallet}>
            <Txt weight="displayBold" size={15} color={C.text}>Cüzdan</Txt>
            <Icon name="chev" size={15} color={C.dim} />
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <CoinBadge size={17} />
              <Txt weight="extrabold" size={13.5} color={C.gold}>12.4K</Txt>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 16 }}>
              <DiamondBadge size={17} />
              <Txt weight="extrabold" size={13.5} color="#22D3EE">860</Txt>
            </View>
          </Pressable>

          <Pressable onPress={() => { haptic.light(); setStreamer(!isStreamer); }} style={styles.streamerToggle}>
            <Txt weight="semibold" size={11} color={C.dim} style={{ flex: 1 }}>Demo · Yayıncı hesabı</Txt>
            <View style={[styles.toggle, { backgroundColor: isStreamer ? C.green : "rgba(255,255,255,.12)", alignItems: isStreamer ? "flex-end" : "flex-start" }]}>
              <View style={styles.knob} />
            </View>
          </Pressable>

          <View style={styles.roleRow}>
            <Txt weight="semibold" size={11} color={C.dim} style={{ flex: 1 }}>Demo · Rol</Txt>
            {(["user", "developer", "super_admin"] as const).map((r) => {
              const on = role === r;
              const col = r === "super_admin" ? "#EF4444" : r === "developer" ? "#A78BFA" : C.dim;
              return (
                <Pressable key={r} onPress={() => { haptic.select(); setRole(r); }} style={[styles.roleChip, { borderColor: on ? col : C.line, backgroundColor: on ? col + "1F" : "transparent" }]}>
                  <Txt weight="extrabold" size={10} color={on ? col : C.dim2}>{r === "user" ? "Üye" : r === "developer" ? "Dev" : "Admin"}</Txt>
                </Pressable>
              );
            })}
          </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  cover: { height: 104, position: "relative" },
  editBtn: { position: "absolute", right: 14, bottom: 12, width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(0,0,0,.3)", alignItems: "center", justifyContent: "center" },
  camBadge: { position: "absolute", right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: C.gold2, borderWidth: 2.5, borderColor: "#08080C", alignItems: "center", justifyContent: "center" },
  tileRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, backgroundColor: "rgba(255,255,255,.03)", borderRadius: 20, paddingVertical: 16, paddingHorizontal: 8 },
  wallet: { flexDirection: "row", alignItems: "center", marginTop: 16, backgroundColor: "rgba(255,255,255,.03)", borderRadius: 20, padding: 16 },
  streamerToggle: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderStyle: "dashed", borderColor: C.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderStyle: "dashed", borderColor: C.line, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14 },
  roleChip: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1 },
  hiddenPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "44", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  toggle: { width: 38, height: 22, borderRadius: 999, padding: 2, justifyContent: "center" },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  menuGroup: { marginTop: 14, backgroundColor: "rgba(255,255,255,.03)", borderRadius: 20, padding: 6 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12 },
});
