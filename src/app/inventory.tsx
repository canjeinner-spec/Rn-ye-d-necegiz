import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FramePreview } from "@/components/FramePreview";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { INV_TABS, INVENTORY, type InvKategori } from "@/data/inventory";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Equipped = Record<InvKategori, string | null>;

export default function InventoryScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<InvKategori>("frame");
  const [equipped, setEquipped] = useState<Equipped>({ frame: "gumus", entry: "e_alev", bubble: null });

  const items = INVENTORY[tab] || [];
  const toggle = (id: string) => {
    haptic.light();
    setEquipped((e) => ({ ...e, [tab]: e[tab] === id ? null : id }));
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#08080C"]} deg={180} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Eşyalarım</Txt>
        </View>

        <View style={styles.tabs}>
          {INV_TABS.map(([k, label]) => {
            const on = tab === k;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setTab(k); }} style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
                {on ? (
                  <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={styles.tabInner}>
                    <Txt weight="extrabold" size={12} color="#fff">{label}</Txt>
                  </Gradient>
                ) : (
                  <View style={[styles.tabInner, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                    <Txt weight="extrabold" size={12} color={C.dim}>{label}</Txt>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Txt weight="semibold" size={12.5} color={C.dim}>Bu kategoride eşyan yok.</Txt>
              <Txt size={11} color={C.dim2} style={{ marginTop: 4 }}>Mağazadan edinebilirsin.</Txt>
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map((it) => {
                const active = equipped[tab] === it.id;
                return (
                  <View key={it.id} style={[styles.card, { borderColor: active ? C.purple : "rgba(255,255,255,.07)", backgroundColor: active ? "rgba(124,58,237,.12)" : "rgba(255,255,255,.03)" }]}>
                    {active && (
                      <View style={styles.equipBadge}>
                        <Txt weight="extrabold" size={8.5} color="#fff">KUŞANILDI</Txt>
                      </View>
                    )}
                    <View style={styles.visual}>
                      {tab === "frame" ? (
                        <View style={{ width: 52, height: 52 }}>
                          <Portrait name="Sen" size={52} ring="transparent" glow={false} />
                          <FramePreview id={it.id} size={52} />
                        </View>
                      ) : (
                        <View style={[styles.emojiCircle, { backgroundColor: `${it.c}1A`, borderColor: `${it.c}44`, shadowColor: it.c }]}>
                          <Txt size={28}>{it.emoji}</Txt>
                        </View>
                      )}
                    </View>
                    <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>{it.name}</Txt>
                    <Txt weight="semibold" size={9.5} color={it.left === "Süresiz" ? C.green : C.dim} style={{ marginTop: 3 }}>
                      {it.left === "Süresiz" ? "♾ Süresiz" : `⏳ ${it.left} kaldı`}
                    </Txt>
                    <Pressable onPress={() => toggle(it.id)} style={{ width: "100%", marginTop: 11, borderRadius: 11, overflow: "hidden" }}>
                      {active ? (
                        <View style={[styles.actBtn, { backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: C.line }]}>
                          <Txt weight="extrabold" size={11.5} color={C.dim}>Çıkar</Txt>
                        </View>
                      ) : (
                        <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={styles.actBtn}>
                          <Txt weight="extrabold" size={11.5} color="#fff">Kuşan</Txt>
                        </Gradient>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  tabInner: { paddingVertical: 9, alignItems: "center", borderRadius: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", flexGrow: 1, borderRadius: 18, paddingTop: 16, paddingHorizontal: 12, paddingBottom: 12, alignItems: "center", borderWidth: 1.5 },
  equipBadge: { position: "absolute", top: 8, right: 8, backgroundColor: C.purple, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, zIndex: 2 },
  visual: { height: 74, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emojiCircle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 1, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  actBtn: { paddingVertical: 9, alignItems: "center", borderRadius: 11 },
});
