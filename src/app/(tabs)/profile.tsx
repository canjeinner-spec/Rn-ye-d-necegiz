import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BadgeRow } from "@/components/BadgeRow";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { MenuIcon } from "@/components/MenuIcon";
import { Pill } from "@/components/Pill";
import { Portrait } from "@/components/Portrait";
import { Sheet } from "@/components/Sheet";
import { TileIcon, type TileType } from "@/components/TileIcon";
import { Txt } from "@/components/Txt";
import { type BadgeItem } from "@/data/badges";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type MenuItem = { ic: IconName; g1: string; g2: string; t: string; s?: string; r?: string; onPress: () => void };

const PUBLIC_ID = "4407";

export default function ProfileTab() {
  const router = useRouter();
  const { userName, userPhoto, setUserPhoto, isStreamer, setStreamer } = useApp();
  const [stub, setStub] = useState<string | null>(null);

  const ahead = (label: string) => () => setStub(`${label} — Aşama 5`);
  const goMyRoom = () => { haptic.light(); router.navigate("/my-room"); };

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!res.canceled) setUserPhoto(res.assets[0].uri);
  };

  const badges: BadgeItem[] = [
    { type: "developer" },
    { type: "vip" },
    { type: "level", lvl: 12 },
    { type: "agency", meta: { id: "1", name: "Aron Stars", owner: "Ardaowski" } },
    ...(isStreamer ? [{ type: "streamer" as const }] : []),
  ];

  const tiles: { type: TileType; lbl: string; onPress: () => void }[] = [
    { type: "tasks", lbl: "Görevler", onPress: ahead("Görevler") },
    { type: "store", lbl: "Mağaza", onPress: () => { haptic.light(); router.navigate("/store"); } },
    { type: "items", lbl: "Eşyalarım", onPress: ahead("Eşyalarım") },
    { type: "level", lbl: "Level", onPress: ahead("Level") },
  ];

  const menu: MenuItem[] = [
    { ic: "mic", g1: "#A855F7", g2: "#6D28D9", t: "Odam", s: "Kendi sesli sohbet odanı aç", onPress: goMyRoom },
    { ic: "crown", g1: "#F5CE6E", g2: "#B45309", t: "Aron VIP", s: "Özel ayrıcalıkların kilidini aç", onPress: () => { haptic.light(); router.navigate("/vip"); } },
    ...(isStreamer ? [{ ic: "mic" as IconName, g1: "#34D399", g2: "#059669", t: "Yayıncı Paneli", s: "Kazancını ve ajansını yönet", onPress: ahead("Yayıncı Paneli") }] : []),
    { ic: "gift", g1: "#EC4899", g2: "#BE185D", t: "Hediye Geçmişi", s: "Gönderdiğin & aldığın hediyeler", onPress: ahead("Hediye Geçmişi") },
    { ic: "userAdd", g1: "#34D399", g2: "#059669", t: "Arkadaşını Davet Et", s: "Davet et, beraber elmas kazanın", onPress: ahead("Davet") },
    { ic: "flag", g1: "#A855F7", g2: "#7C3AED", t: "Rozetlerim", s: "8 rozet kazandın", onPress: ahead("Rozetlerim") },
    { ic: "idcard", g1: "#F5CE6E", g2: "#B45309", t: "Özel ID", s: "Prestijli kısa ID'leri keşfet", onPress: ahead("Özel ID") },
    { ic: "ticket", g1: "#06B6D4", g2: "#0891B2", t: "Hediye Kuponu Gir", s: "Kodunu gir, ödülünü al", onPress: ahead("Kupon") },
  ];

  const settings: MenuItem[] = [
    { ic: "gear", g1: "#64748B", g2: "#475569", t: "Dil", r: "Türkçe", onPress: ahead("Dil") },
    { ic: "ticket", g1: "#64748B", g2: "#475569", t: "Dönüştürme Kodu", onPress: ahead("Kupon") },
    { ic: "chat", g1: "#64748B", g2: "#475569", t: "Müşteri Hizmetleri & SSS", onPress: ahead("SSS") },
    { ic: "gear", g1: "#475569", g2: "#334155", t: "Hesap & Güvenlik", r: "⚠️", onPress: ahead("Güvenlik") },
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
          <Pressable onPress={ahead("Profili Düzenle")} style={styles.editBtn}>
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
            <View style={{ paddingBottom: 6 }}>
              <Txt weight="displayBold" size={19} color="#fff">{userName}</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                <Txt weight="semibold" size={10.5} color={C.dim}>ID: {PUBLIC_ID}</Txt>
                <Icon name="copy" size={12} color={C.dim2} />
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 7, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <BadgeRow size={28} badges={badges} />
            <Pill bg="rgba(255,255,255,.05)" color={C.dim} border={C.line}>🇹🇷 Türkiye</Pill>
          </View>

          <View style={{ flexDirection: "row", marginTop: 16 }}>
            {([["Ziyaretçi", "1.2K", ahead("Ziyaretçiler")], ["Takip", "96", undefined], ["Takipçi", "128", undefined]] as const).map(([l, v, fn]) => (
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

          {renderMenu(menu)}
          {renderMenu(settings)}
        </View>
      </ScrollView>

      <Sheet visible={!!stub} onClose={() => setStub(null)} contentStyle={{ alignItems: "center" }}>
        <Icon name="gear" size={28} color={C.dim} />
        <Txt weight="bold" size={13} color={C.dim} style={{ marginTop: 12, marginBottom: 4 }}>{stub}</Txt>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  cover: { height: 104, position: "relative" },
  editBtn: { position: "absolute", right: 14, top: 12, width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(0,0,0,.3)", alignItems: "center", justifyContent: "center" },
  camBadge: { position: "absolute", right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: C.gold2, borderWidth: 2.5, borderColor: "#08080C", alignItems: "center", justifyContent: "center" },
  tileRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, backgroundColor: "rgba(255,255,255,.03)", borderRadius: 20, paddingVertical: 16, paddingHorizontal: 8 },
  wallet: { flexDirection: "row", alignItems: "center", marginTop: 16, backgroundColor: "rgba(255,255,255,.03)", borderRadius: 20, padding: 16 },
  streamerToggle: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderStyle: "dashed", borderColor: C.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  toggle: { width: 38, height: 22, borderRadius: 999, padding: 2, justifyContent: "center" },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  menuGroup: { marginTop: 14, backgroundColor: "rgba(255,255,255,.03)", borderRadius: 20, padding: 6 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12 },
});
