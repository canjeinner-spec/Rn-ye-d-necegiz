import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { BosDurum } from "@/components/BosDurum";
import { Txt } from "@/components/Txt";
import BOS_KUTU from "@/anim/bos-kutu.json";
import { NOTIF_TABS, NOTIFS, type BildirimKategori, type BildirimItem } from "@/data/notifications";
import { enrichAvatars, listNotifications, mapNotif, markAllNotifsRead, markNotifRead } from "@/data/remote/notifRepo";
import { getCached, setCached } from "@/lib/cache";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

type TabKey = BildirimKategori | "all";

export default function NotificationsScreen() {
  const router = useRouter();
  const session = useApp((s) => s.session);
  const live = isSupabaseConfigured && !!session;
  const [tab, setTab] = useState<TabKey>("all");
  // Cache-first: son bildirimleri anında göster (persist), arkada tazele.
  const [items, setItems] = useState<BildirimItem[]>(live ? (getCached<BildirimItem[]>("notif:list") ?? []) : NOTIFS);

  // DB'den yükle (ekrana her gelişte)
  useFocusEffect(useCallback(() => {
    if (!live) return;
    let alive = true;
    listNotifications().then((n) => { if (alive) { setItems(n); setCached("notif:list", n, true); } }).catch((e) => console.warn("[notif] list:", e?.message || e));
    return () => { alive = false; };
  }, [live]));

  // Realtime: yeni bildirim gelince başa ekle
  useEffect(() => {
    const sb = supabase;
    if (!live || !sb) return;
    const ch = sb.channel(`notif-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bildirimler" }, (payload) => {
        const item = mapNotif(payload.new as never);
        enrichAvatars([item]).then(([e]) => setItems((prev) => [e, ...prev])).catch(() => setItems((prev) => [item, ...prev]));
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
  const tapOne = (n: BildirimItem) => {
    setItems(items.map((x) => (x.id === n.id ? { ...x, okunmadi: false } : x)));
    if (live) markNotifRead(n.id).catch(() => {});
    if (n.publicId) router.navigate(`/user-profile?publicId=${encodeURIComponent(n.publicId)}`);
  };

  return (
    <View style={styles.root}>
      <Zemin />
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
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: C.kontrol }]} />
                )}
                {/* Seçili hap altın dolgulu; üstünde beyaz yazı okunmuyordu */}
                <Txt weight="extrabold" size={12} color={on ? "#241A05" : C.dim}>{label}</Txt>
                {cnt > 0 && (
                  <View style={[styles.badge, { backgroundColor: on ? "rgba(36,26,5,.30)" : C.red }]}>
                    <Txt weight="extrabold" size={9} color={on ? "#241A05" : "#fff"}>{cnt}</Txt>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 && (
            <BosDurum
              anim={BOS_KUTU}
              baslik="Bildirim yok"
              alt="Bu kategoride henüz bir şey olmadı. Yeni bir gelişme olduğunda burada görürsün."
            />
          )}
          {filtered.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => tapOne(n)}
              style={[styles.row, { backgroundColor: n.okunmadi ? "rgba(124,58,237,.08)" : "transparent", borderColor: n.okunmadi ? "rgba(124,58,237,.2)" : "transparent" }]}
            >
              {n.actorId != null ? (
                // İlgili kişinin güncel avatarı + üzerinde küçük tür ikonu (Twitter gibi)
                <View>
                  <Portrait name={n.baslik} size={42} photo={n.avatar} ring="rgba(255,255,255,.12)" />
                  <View style={[styles.typeBadge, { backgroundColor: n.renk }]}>
                    <Txt size={10}>{n.ikon}</Txt>
                  </View>
                </View>
              ) : (
                <View style={[styles.notifIcon, { backgroundColor: `${n.renk}1A`, borderColor: `${n.renk}40` }]}>
                  <Txt size={20}>{n.ikon}</Txt>
                </View>
              )}
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
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: 8, alignItems: "center", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  tab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 32, paddingHorizontal: 15, borderRadius: 999, overflow: "hidden" },
  badge: { minWidth: 15, height: 15, borderRadius: 999, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 13, paddingHorizontal: 12, borderRadius: 16, marginBottom: 6, borderWidth: 1 },
  notifIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  typeBadge: { position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.bg },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.red },
});
