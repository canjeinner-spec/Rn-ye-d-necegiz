import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Sheet } from "@/components/Sheet";
import { OfficialAvatar, SystemAvatar } from "@/components/SpecialAvatars";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { DM_THREADS, type DMThread } from "@/data/dm";
import { DM_ID_OFFSET, listThreads } from "@/data/remote/dmRepo";
import { listAnnouncements } from "@/data/remote/announceRepo";
import { getUnreadCount } from "@/data/remote/notifRepo";
import { getCached, setCached } from "@/lib/cache";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { FEATURES } from "@/lib/features";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

// MVP: Arkadaşlık / Etkinlik / Bildirim kısayolları gizli (FEATURES.*) — ekranlar duruyor
const QUICK: { ic: IconName; t: string; g1: string; g2: string; badge?: number; route?: string; flag?: boolean }[] = [
  { ic: "userAdd", t: "Arkadaşlık", g1: "#34D399", g2: "#059669", badge: 2, route: "/friends", flag: FEATURES.friends },
  { ic: "mega", t: "Etkinlik", g1: "#60A5FA", g2: "#2563EB", route: "/events", flag: FEATURES.events },
  { ic: "bell", t: "Bildirim", g1: "#F5CE6E", g2: "#C8922B", route: "/notifications", flag: FEATURES.notifications },
  { ic: "eye", t: "Ziyaretçi", g1: "#A855F7", g2: "#7C3AED", route: "/visitors", flag: FEATURES.visitors },
];

function Avatar({ d }: { d: DMThread }) {
  if (d.official) return <OfficialAvatar size={48} />;
  if (d.system) return <SystemAvatar size={48} />;
  return <Portrait name={d.name} size={48} online={d.online} photo={d.photo} />;
}

// Resmi (Aron) + Sistem kanalları; önizleme gerçek son duyurudan gelir.
const SPECIAL_THREADS = DM_THREADS.filter((d) => d.official || d.system);
function kisaZaman(at: number) {
  const d = new Date(at);
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DmTab() {
  const router = useRouter();
  const setActiveDM = useApp((s) => s.setActiveDM);
  const session = useApp((s) => s.session);
  const [tab, setTab] = useState(0);
  // Cache-first: son sohbet listesini anında göster (persist), arkada tazele.
  const [dbThreads, setDbThreads] = useState<DMThread[]>(() => getCached<DMThread[]>("dm:threads") ?? []);
  const [notifUnread, setNotifUnread] = useState(0);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [actionFor, setActionFor] = useState<DMThread | null>(null);
  const [stub, setStub] = useState<string | null>(null);
  const [special, setSpecial] = useState<DMThread[]>(SPECIAL_THREADS);

  const reload = useCallback(() => {
    if (!isSupabaseConfigured || !session) return;
    listThreads().then((t) => { setDbThreads(t); setCached("dm:threads", t, true); }).catch((e) => console.warn("[dm] listThreads:", e?.message || e));
    // Resmi/sistem thread önizlemesi = ilgili kanaldaki son duyuru
    Promise.all([listAnnouncements("aron", 1).catch(() => []), listAnnouncements("sistem", 1).catch(() => [])]).then(([a, s]) => {
      setSpecial(SPECIAL_THREADS.map((t) => {
        const latest = t.official ? a[0] : t.system ? s[0] : undefined;
        return latest ? { ...t, last: latest.baslik, time: kisaZaman(latest.at) } : t;
      }));
    }).catch(() => {});
  }, [session]);

  // Ekrana her dönüşte tazele (thread'ler + bildirim sayısı)
  useFocusEffect(useCallback(() => {
    reload();
    if (isSupabaseConfigured && session) getUnreadCount().then(setNotifUnread).catch(() => {});
  }, [reload, session]));

  // Realtime: yeni mesaj geldiğinde thread listesini tazele
  useEffect(() => {
    const sb = supabase;
    if (!isSupabaseConfigured || !session || !sb) return;
    // Benzersiz kanal adı: aynı isimli (abone olmuş) kanalın yeniden kullanılıp
    // ".on() after subscribe()" hatası vermesini önler.
    const ch = sb
      .channel(`dm-threads-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_mesajlari" }, (payload) => {
        // Silinmiş (gizlenmiş) bir konuşmaya yeni mesaj geldiyse gizlemeyi kaldır → kutuya geri düşer
        const convId = (payload.new as { konusma_id?: number })?.konusma_id;
        if (convId != null) {
          setHidden((h) => {
            const tid = DM_ID_OFFSET + convId;
            if (!h.has(tid)) return h;
            const n = new Set(h);
            n.delete(tid);
            return n;
          });
        }
        reload();
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [session, reload]);

  const threads = [...special, ...dbThreads].filter((d) => !hidden.has(d.id));
  const filtered = threads.filter((d) => (tab === 0 ? true : tab === 1 ? d.unread > 0 : d.online));

  const openChat = (d: DMThread) => {
    haptic.light();
    setActiveDM(d);
    router.navigate("/dm-chat");
  };
  const deleteThread = () => {
    if (!actionFor) return;
    setHidden((h) => new Set(h).add(actionFor.id));
    setActionFor(null);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Txt weight="displayBold" size={21} color="#fff">Mesajlar</Txt>
          <Pressable onPress={() => { haptic.light(); router.navigate("/user-search"); }} style={styles.iconBtn}>
            <Icon name="userAdd" size={18} color={C.text} />
          </Pressable>
        </View>

        {QUICK.some((q) => q.flag !== false) && (
        <View style={styles.quickRow}>
          {QUICK.filter((q) => q.flag !== false).map((q) => {
            const badge = q.t === "Bildirim" ? notifUnread : q.badge;
            return (
            <Pressable key={q.t} onPress={() => { haptic.light(); q.route ? router.navigate(q.route as never) : setStub(`${q.t} — Aşama 5`); }} style={{ width: 74, alignItems: "center", gap: 8 }}>
              <View>
                <Gradient colors={[q.g1, q.g2]} deg={135} style={styles.quickTile}>
                  <Gradient colors={["rgba(255,255,255,.22)", "rgba(255,255,255,0)"]} deg={180} locations={[0, 0.55]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  <Icon name={q.ic} size={24} color="#fff" />
                </Gradient>
                {badge != null && badge > 0 && (
                  <View style={styles.quickBadge}>
                    <Txt weight="extrabold" size={10} color="#fff">{badge > 99 ? "99+" : badge}</Txt>
                  </View>
                )}
              </View>
              <Txt weight="bold" size={10.5} color={C.dim}>{q.t}</Txt>
            </Pressable>
            );
          })}
        </View>
        )}

        <Tabs items={["Tümü", "Okunmamış", "Online"]} active={tab} set={setTab} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {filtered.map((d) => (
            <Pressable key={d.id} onPress={() => openChat(d)} onLongPress={() => { haptic.medium(); setActionFor(d); }} style={styles.threadRow}>
              <Avatar d={d} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                    <Txt weight="extrabold" size={13.5} color={C.text} numberOfLines={1}>{d.name}</Txt>
                    {d.official && (
                      <View style={styles.resmiTag}>
                        <Txt weight="extrabold" size={8.5} color="#93C5FD">RESMİ</Txt>
                      </View>
                    )}
                  </View>
                  <Txt weight="semibold" size={10} color={C.dim2}>{d.time}</Txt>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <Txt size={11.5} color={C.dim} numberOfLines={1} style={{ flex: 1 }}>{d.last}</Txt>
                  {d.unread > 0 && (
                    <View style={styles.unread}>
                      <Txt weight="extrabold" size={9.5} color="#fff">{d.unread}</Txt>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
          {filtered.length === 0 && <Txt size={12.5} color={C.dim} align="center" style={{ paddingVertical: 50 }}>Sohbet yok.</Txt>}
        </ScrollView>
      </SafeAreaView>

      <Sheet visible={!!actionFor} onClose={() => setActionFor(null)}>
        {actionFor && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14, paddingHorizontal: 4 }}>
              <Avatar d={actionFor} />
              <Txt weight="extrabold" size={14} color={C.text}>{actionFor.name}</Txt>
            </View>
            {!actionFor.official && !actionFor.system && (
              <Pressable onPress={() => setActionFor(null)} style={styles.actBtn}>
                <Icon name="blockuser" size={17} color="#FB7185" />
                <Txt weight="bold" size={13.5} color="#FB7185">Engelle</Txt>
              </Pressable>
            )}
            <Pressable onPress={deleteThread} style={styles.actBtn}>
              <Icon name="trash" size={17} color={C.red} />
              <Txt weight="bold" size={13.5} color={C.red}>Sohbeti Sil</Txt>
            </Pressable>
            <Pressable onPress={() => setActionFor(null)} style={[styles.actBtn, { justifyContent: "center", backgroundColor: "rgba(255,255,255,.04)" }]}>
              <Txt weight="bold" size={13.5} color={C.dim}>Vazgeç</Txt>
            </Pressable>
          </>
        )}
      </Sheet>

      <Sheet visible={!!stub} onClose={() => setStub(null)} contentStyle={{ alignItems: "center" }}>
        <Icon name="bell" size={28} color={C.dim} />
        <Txt weight="bold" size={13} color={C.dim} style={{ marginTop: 12, marginBottom: 4 }}>{stub}</Txt>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  quickRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  quickTile: { width: 56, height: 56, borderRadius: 17, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  quickBadge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#F43F5E", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#0A0A0F" },
  threadRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16 },
  resmiTag: { backgroundColor: "#3B82F622", borderWidth: 1, borderColor: "#3B82F644", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  unread: { backgroundColor: C.purple, borderRadius: 999, minWidth: 17, height: 17, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  actBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)", marginBottom: 8 },
});
