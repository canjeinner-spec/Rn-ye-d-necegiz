import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthorityTag } from "@/components/AuthorityTag";
import { Badge } from "@/components/Badge";
import { DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { RolePill } from "@/components/RolePill";
import { Txt } from "@/components/Txt";
import { odaKatki, type KatkiSatiri } from "@/data/remote/hediyeRepo";
import { Icon } from "@/icons/Icon";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/** Sekme sırası → sorgulanacak saat penceresi. */
const PENCERE = [24, 168] as const;

export function ContributionView({
  odaId,
  host,
  onClose,
  onOpenUser,
}: {
  /** Gerçek oda kimliği. Yoksa (demo oda) liste boş kalır. */
  odaId?: number | null;
  host: string;
  onClose: () => void;
  onOpenUser: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { userName, userPhoto, role, dbId } = useApp();
  const privileged = role !== "user";
  const [tab, setTab] = useState(0);
  const [liste, setListe] = useState<KatkiSatiri[] | null>(null);

  /**
   * GERÇEK VERİ (083). Eskiden burada uydurma bir dizi vardı:
   *     const seed7  = [90, 48, 32, 21, 14, 9, 6, 3];
   *     const seed24 = [12, 7, 4, 2, 1];
   * ...ve odadaki kişilere sırayla dağıtılıyordu. Yani sıralama da, rakamlar
   * da, "Katkın" değeri de sahteydi; kim ne gönderdiyse hiç etkisi yoktu.
   * Veri baştan beri `hediye_gecmisi`de duruyordu, eksik olan okuma yoluydu.
   */
  useEffect(() => {
    if (odaId == null) { setListe([]); return; }
    let alive = true;
    setListe(null);
    odaKatki(odaId, PENCERE[tab])
      .then((k) => { if (alive) setListe(k); })
      .catch(() => { if (alive) setListe([]); });
    return () => { alive = false; };
  }, [odaId, tab]);

  const list = liste ?? [];
  const total = list.reduce((s, x) => s + x.toplam, 0);
  const top = list[0];
  const rest = list.slice(1);
  const benim = dbId != null ? list.find((x) => x.kullaniciId === dbId) : undefined;
  const myVal = benim?.toplam ?? 0;
  const mySira = benim?.sira;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
          <Pressable style={{ flex: 1 }}>
            <Gradient colors={["#241B0A", "#0A0810"]} deg={150} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.handle} />
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <Icon name="x" size={18} color={C.text} />
              </Pressable>
              <Txt weight="displayBold" size={16} color="#fff" style={{ flex: 1, textAlign: "center", marginLeft: -34 }}>Katkı</Txt>
            </View>

            <View style={styles.tabs}>
              {["Son 24 Saat", "Son 7 Gün"].map((t, i) => (
                <Pressable key={t} onPress={() => setTab(i)} style={styles.tabBtn}>
                  <Txt weight={i === tab ? "extrabold" : "medium"} size={14.5} color={i === tab ? "#fff" : "rgba(255,255,255,.4)"}>{t}</Txt>
                  {i === tab && <View style={styles.tabUnderline} />}
                </Pressable>
              ))}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
                <View style={styles.totalPill}>
                  <Txt size={15}>🏆</Txt>
                  <Txt weight="displayBold" size={14} color="#fff">{total}</Txt>
                </View>
                {/* Sabit "21:44" yaziyordu. Pencere zaten sekmeden belli. */}
                <Txt weight="semibold" size={11.5} color={C.dim}>
                  {tab === 0 ? "Son 24 saat" : "Son 7 gün"}
                </Txt>
              </View>

              {top ? (
                <>
                  <View style={{ alignItems: "center", paddingTop: 22, paddingBottom: 8 }}>
                    <Pressable onPress={() => onOpenUser(top.ad)} style={{ alignItems: "center" }}>
                      <Txt size={30} style={{ marginBottom: -14, zIndex: 2 }}>👑</Txt>
                      <Portrait name={top.ad} size={96} ring={C.gold} glow photo={top.foto || undefined} />
                      <View style={styles.top1}>
                        <Txt weight="displayBold" size={13} color="#7C2D12" style={{ letterSpacing: 0.5 }}>TOP.1</Txt>
                      </View>
                    </Pressable>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 18 }}>
                      <Txt weight="displayBold" size={17} color="#fff">{top.ad}</Txt>
                      <Badge type="vip" size={17} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 }}>
                      <Txt size={12} color={C.dim}>Katkıda Bulundu:</Txt>
                      <DiamondBadge size={15} />
                      <Txt weight="displayBold" size={15} color={C.gold2}>{top.toplam}</Txt>
                    </View>
                  </View>

                  <View style={{ paddingTop: 8 }}>
                    {rest.map((r, i) => (
                      <Pressable key={r.kullaniciId} onPress={() => onOpenUser(r.ad)} style={styles.rankRow}>
                        <Txt weight="displayBold" size={15} color={i < 2 ? C.gold2 : C.dim} style={{ width: 18 }}>{r.sira}</Txt>
                        <Portrait name={r.ad} size={42} ring="rgba(255,255,255,.14)" photo={r.foto || undefined} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{r.ad}</Txt>
                            {r.ad === host && <RolePill type="host" />}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                            <DiamondBadge size={13} />
                            <Txt weight="extrabold" size={12} color={C.gold2}>{r.toplam}</Txt>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <Txt size={12.5} color={C.dim} align="center" style={{ paddingVertical: 70 }}>
                  {liste === null ? "Yükleniyor…" : "Bu dönemde henüz katkı yok."}
                </Txt>
              )}
            </ScrollView>

            <View style={[styles.myRank, { paddingBottom: 14 + insets.bottom }]}>
              <Txt weight="displayBold" size={14} color={mySira ? C.gold2 : C.dim} style={{ width: 18 }}>
                {mySira ?? "—"}
              </Txt>
              <Portrait name="Sen" size={42} ring={C.gold} photo={userPhoto || undefined} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Txt weight="extrabold" size={13} color="#fff">{userName}</Txt>
                  {privileged && <AuthorityTag size={8} />}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <DiamondBadge size={13} />
                  <Txt weight="extrabold" size={12} color={C.gold2}>{myVal}</Txt>
                </View>
              </View>
              <Txt size={10.5} color={C.dim2}>Katkın</Txt>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.55)" },
  sheet: { height: "82%", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.16)", backgroundColor: "#0A0810" },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.2)", alignSelf: "center", marginTop: 10 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)", paddingHorizontal: 24, marginTop: 6 },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: "center" },
  tabUnderline: { position: "absolute", bottom: -1, width: 30, height: 3, borderRadius: 3, backgroundColor: "#22D3EE" },
  totalPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 7, paddingLeft: 10, paddingRight: 14, borderRadius: 999, backgroundColor: "rgba(124,58,237,.3)", borderWidth: 1, borderColor: "rgba(168,85,247,.3)" },
  top1: { position: "absolute", bottom: -8, paddingVertical: 3, paddingHorizontal: 18, borderRadius: 6, backgroundColor: "#F59E0B", borderWidth: 1.5, borderColor: "#FDE68A" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 12, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.05)" },
  myRank: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(10,8,16,.96)" },
});
