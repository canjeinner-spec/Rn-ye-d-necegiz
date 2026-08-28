import { BlurView } from "expo-blur";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * Mikrofon sırası — TEK amaçlı sayfa.
 *
 * Eskiden bu, oda profili panelinin (RoomPanel) 3. sekmesiydi: mikrofon
 * ikonuna basınca oda kimlik kartı, üç sekme ve altta "Katıl / Takip Et"
 * butonları geliyordu. Sıraya bakmak isteyen kullanıcı oda profiline
 * giriyordu — hem kalabalık hem kafa karıştırıcıydı (katıl/takip zaten
 * oda çipinden erişilebiliyor).
 *
 * Burada yalnızca sıra var: kimler bekliyor, ben neredeyim, el kaldır/çık.
 * Oda sahibi/yardımcısı ayrıca "Al" ve "Çıkar" yapabilir.
 */
export function MicQueueSheet({
  queue,
  myUid,
  myRaised,
  canModerate,
  onRaise,
  onLower,
  onApprove,
  onClose,
}: {
  /** undefined → mock oda (sıra sistemi yok) */
  queue?: { uid: number; name: string; photo?: string; at: number }[];
  myUid?: number | null;
  myRaised?: boolean;
  canModerate?: boolean;
  onRaise?: () => void;
  onLower?: (uid?: number) => void;
  onApprove?: (uid: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const liste = queue ?? [];
  const sirada = liste.length;
  const benimSira = myUid != null ? liste.findIndex((q) => q.uid === myUid) : -1;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(280)} style={styles.sheet}>
          {/* iç tıklama sayfayı kapatmasın */}
          <Pressable>
            <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(22,19,32,0.90)", "rgba(11,10,16,0.95)"]} deg={170} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.handle} />

            {/* Başlık */}
            <View style={styles.header}>
              <View style={styles.headIcon}>
                <Icon name="hand" size={17} color={C.gold} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="displayBold" size={15.5} color="#fff">Mikrofon Sırası</Txt>
                <Txt weight="semibold" size={11} color={C.dim} style={{ marginTop: 2 }}>
                  {queue === undefined
                    ? "Bu odada sıra sistemi yok"
                    : sirada === 0
                      ? "Şu an bekleyen yok"
                      : benimSira >= 0
                        ? `${sirada} kişi bekliyor · sen ${benimSira + 1}. sıradasın`
                        : `${sirada} kişi bekliyor`}
                </Txt>
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={styles.kapatBtn}>
                <Icon name="x" size={15} color={C.dim} />
              </Pressable>
            </View>

            {/* Liste */}
            {queue === undefined || sirada === 0 ? (
              <View style={styles.bos}>
                <Txt size={12.5} color={C.dim} align="center" lh={1.5} style={{ maxWidth: 260 }}>
                  {queue === undefined
                    ? "Mikrofona çıkmak isteyenler yakında burada sıraya girebilecek."
                    : "El kaldıran ilk kişi sen ol — oda sahibi onaylayınca mikrofona geçersin."}
                </Txt>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
                <View style={styles.grup}>
                  {liste.map((q, i) => {
                    const benim = q.uid === myUid;
                    return (
                      <View key={q.uid}>
                        {i > 0 && <View style={styles.ayirici} />}
                        <View style={[styles.satir, benim && { backgroundColor: `${C.gold}0F` }]}>
                          <Txt weight="displayBold" size={13} color={i === 0 ? C.gold2 : C.dim} style={{ width: 26 }}>
                            {i + 1}
                          </Txt>
                          <Portrait name={q.name} size={38} photo={q.photo} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Txt weight="extrabold" size={13} color={benim ? C.gold2 : C.text} numberOfLines={1}>
                              {benim ? "Sen" : q.name}
                            </Txt>
                            {i === 0 && (
                              <Txt weight="bold" size={9.5} color={C.dim2} style={{ marginTop: 2 }}>SIRADAKİ</Txt>
                            )}
                          </View>

                          {canModerate ? (
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              <Pressable
                                onPress={() => { haptic.success(); onApprove?.(q.uid); }}
                                style={[styles.cip, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}
                              >
                                <Icon name="mic" size={12} color={C.green} />
                                <Txt weight="bold" size={10.5} color={C.green}>Al</Txt>
                              </Pressable>
                              <Pressable onPress={() => { haptic.light(); onLower?.(q.uid); }} style={styles.cip}>
                                <Icon name="x" size={11} color={C.dim} />
                              </Pressable>
                            </View>
                          ) : benim ? (
                            <Pressable onPress={() => { haptic.light(); onLower?.(q.uid); }} style={styles.cip}>
                              <Txt weight="bold" size={10.5} color={C.dim}>Vazgeç</Txt>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Tek birincil aksiyon. onRaise verilmemişse (ör. oda sahibi —
                kendi koltuğu var, sıraya giremez) buton hiç çizilmez. */}
            {queue !== undefined && (onRaise || myRaised) && (
              <View style={[styles.altBar, { paddingBottom: 12 + insets.bottom }]}>
                <Pressable
                  onPress={() => { haptic.light(); myRaised ? onLower?.() : onRaise?.(); }}
                  style={{ borderRadius: 14, overflow: "hidden" }}
                >
                  {myRaised ? (
                    <View style={[styles.aksiyon, { borderWidth: 1.5, borderColor: "rgba(255,255,255,.14)", backgroundColor: "rgba(255,255,255,.05)" }]}>
                      <Icon name="x" size={15} color={C.dim} />
                      <Txt weight="extrabold" size={13.5} color={C.dim}>Sıradan Çık</Txt>
                    </View>
                  ) : (
                    <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.aksiyon}>
                      <Icon name="hand" size={16} color="#241A05" />
                      <Txt weight="extrabold" size={13.5} color="#241A05">El Kaldır</Txt>
                    </Gradient>
                  )}
                </Pressable>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.55)" },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    backgroundColor: "rgba(14,12,20,0.6)",
  },
  handle: { width: 38, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.2)", alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  headIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}44` },
  kapatBtn: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.06)" },
  bos: { alignItems: "center", paddingHorizontal: 18, paddingVertical: 26 },
  grup: { borderRadius: 16, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", overflow: "hidden" },
  ayirici: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 74 },
  satir: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  cip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  altBar: { paddingHorizontal: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 6 },
  aksiyon: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14 },
});
