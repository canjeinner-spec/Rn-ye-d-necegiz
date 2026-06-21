import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import { NOTIF_TABS, NOTIFS, type BildirimKategori, type BildirimItem } from "@/data/notifications";
import { listNotifications, mapNotif, markAllNotifsRead, markNotifRead } from "@/data/remote/notifRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type TabKey = BildirimKategori | "all";

export default function NotificationsScreen() {
  const router = useRouter();
  const session = useApp((s) => s.session);
  const live = isSupabaseConfigured && !!session;
  const [tab, setTab] = useState<TabKey>("all");
  const [items, setItems] = useState<BildirimItem[]>(live ? [] : NOTIFS);

  // DB'den yükle (ekrana her gelişte)
  useFocusEffect(useCallback(() => {
    if (!live) return;
    let alive = true;
    listNotifications().then((n) => { if (alive) setItems(n); }).catch((e) => console.warn("[notif] list:", e?.message || e));
    return () => { alive = false; };
  }, [live]));

  // Realtime: yeni bildirim gelince başa ekle
  useEffect(() => {
    const sb = supabase;
    if (!live || !sb) return;
    const ch = sb.channel(`notif-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bildirimler" }, (payload) => {
        setItems((prev) => [mapNotif(payload.new as never), ...prev]);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [live]);

  const filtered = tab === "all" ? items : items.filter((n) => n.kategori === tab);
  const unread = items.filter((n) => n.okunmadi).length;
  const markAll = () => {
    haptic.light();
    setItems(items.map((n) => ({ ...n, okunmadi: false })));
    if (live) markAllNotifsRead().catch(() => {});
  };
  const tapOne = (id: number) => {
    setItems(items.map((n) => (n.id === id ? { ...n, okunmadi: false } : n)));
    if (live) markNotifRead(id).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#08080C"]} deg={180} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Bildirimler</Txt>
          <View style={{ flex: 1 }} />
          {unread > 0 && (
            <Pressable onPress={markAll}>
              <Txt weight="bold" size={11.5} color={C.purple2}>Tümünü okundu işaretle</Txt>
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
          {NOTIF_TABS.map(([k, label]) => {
            const on = tab === k;
            const cnt = k === "all" ? unread : items.filter((n) => n.kategori === k && n.okunmadi).length;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setTab(k); }} style={styles.tab}>
                {on ? (
                  <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,.06)" }]} />
                )}
                <Txt weight="extrabold" size={12} color={on ? "#fff" : C.dim}>{label}</Txt>
                {cnt > 0 && (
                  <View style={[styles.badge, { backgroundColor: on ? "rgba(255,255,255,.25)" : C.red }]}>
                    <Txt weight="extrabold" size={9} color="#fff">{cnt}</Txt>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 && (
            <Txt weight="semibold" size={12.5} color={C.dim} align="center" style={{ paddingVertical: 60 }}>Bu kategoride bildirim yok.</Txt>
          )}
          {filtered.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => tapOne(n.id)}
              style={[styles.row, { backgroundColor: n.okunmadi ? "rgba(124,58,237,.08)" : "transparent", borderColor: n.okunmadi ? "rgba(124,58,237,.2)" : "transparent" }]}
            >
              <View style={[styles.notifIcon, { backgroundColor: `${n.renk}1A`, borderColor: `${n.renk}40` }]}>
                <Txt size={20}>{n.ikon}</Txt>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Txt weight="extrabold" size={13} color={C.text}>{n.baslik}</Txt>
                  {n.okunmadi && <View style={styles.dot} />}
                </View>
                <Txt size={11.5} color={C.dim} lh={1.5} style={{ marginTop: 3 }}>{n.icerik}</Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 7 }}>
                  <Txt weight="semibold" size={10} color={C.dim2}>{n.zaman}</Txt>
                  {n.aksiyon && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Txt weight="extrabold" size={11} color={C.purple2}>{n.aksiyon}</Txt>
                      <Icon name="chev" size={12} color={C.purple2} />
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: 8, alignItems: "center", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  tab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 32, paddingHorizontal: 15, borderRadius: 999, overflow: "hidden" },
  badge: { minWidth: 15, height: 15, borderRadius: 999, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 13, paddingHorizontal: 12, borderRadius: 16, marginBottom: 6, borderWidth: 1 },
  notifIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.red },
});
