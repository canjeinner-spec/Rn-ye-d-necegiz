import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { CamZemin } from "@/components/CamZemin";
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
 * giriyordu — hem kalabalık hem kafa karıştırıcıydı.
 *
 * Burada yalnızca sıra var: kimler bekliyor, ben neredeyim, el kaldır/çık.
 * Oda sahibi/yardımcısı ayrıca "Al" ve "Çıkar" yapabilir.
 *
 * ---------------------------------------------------------------------------
 * YERLEŞİM — iki kez yanlış yapıldı, ikisi de burada not:
 *
 * 1. `insets.bottom` YALNIZCA alt aksiyon barının içindeydi. Oda sahibi
 *    sıraya giremediği için o bar hiç çizilmiyor; sahibin ekranında liste
 *    doğrudan ekranın en altına, home indicator'ın üstüne yapışıyordu.
 * 2. Boşluk dıştaki `Animated.View`'a verildi. Ama blur/gradyan arka plan
 *    İÇ kapsayıcıda `absoluteFill` olarak duruyor — boşluk arka planın
 *    DIŞINDA kaldı ve altta saydam bir şerit oluştu, odanın alt barı
 *    oradan görünüyordu.
 *
 * Doğrusu: güvenli alan boşluğu, arka planı taşıyan kapsayıcının KENDİ
 * `paddingBottom`'ı olacak. Böylece blur da gradyan da o boşluğu kaplıyor.
 * ---------------------------------------------------------------------------
 */
export function MicQueueSheet({
  queue,
  myUid,
  myRaised,
  alreadyOnMic,
  onAlreadyOnMic,
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
  /** Zaten koltuktayım — buton pasifleşir, basınca sayfa kapanır. */
  alreadyOnMic?: boolean;
  /** Pasif butona basılınca (sayfayı kapatıp bilgilendirmeyi basmak için). */
  onAlreadyOnMic?: () => void;
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

  /**
   * Alt aksiyon barı çiziliyor mu? Oda sahibi sıraya giremediği için
   * `onRaise` verilmez ve bar hiç çizilmez.
   */
  const altBarVar = queue !== undefined && (alreadyOnMic || !!(onRaise || myRaised));

  const ozet =
    queue === undefined
      ? "Bu odada sıra sistemi yok"
      : sirada === 0
        ? "Şu an bekleyen yok"
        : benimSira >= 0
          ? `${sirada} kişi bekliyor · sen ${benimSira + 1}. sıradasın`
          : `${sirada} kişi bekliyor`;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(280)} style={styles.sheet}>
          {/* İç tıklama sayfayı kapatmasın. Arka plan ve güvenli alan boşluğu
              AYNI kapsayıcıda — boşluk artık blur'un içinde kalıyor. */}
          <Pressable style={{ paddingBottom: insets.bottom }}>
            {/* Bu sayfa zaten neredeyse opak; Android perdesine gerek yok. */}
            <CamZemin
              intensity={34}
              colors={["rgba(24,21,34,0.94)", "rgba(11,10,16,0.97)"]}
              deg={170}
              perde={0}
            />

            <View style={styles.handle} />

            {/* Başlık */}
            <View style={styles.header}>
              <View style={styles.headIcon}>
                <Icon name="hand" size={19} color={C.gold} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="displayBold" size={17} color="#fff">Mikrofon Sırası</Txt>
                <Txt weight="semibold" size={12} color={C.dim} style={{ marginTop: 3 }}>{ozet}</Txt>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.kapatBtn}>
                <Icon name="x" size={17} color={C.dim} />
              </Pressable>
            </View>

            {/* Liste — tek kişi de olsa sayfa oturaklı dursun diye asgari
                yükseklik var; kalabalıkta kaydırmaya açılıyor. */}
            {queue === undefined || sirada === 0 ? (
              <View style={styles.bos}>
                <View style={styles.bosIkon}>
                  <Icon name="hand" size={22} color={C.gold} />
                </View>
                <Txt weight="displayBold" size={14} color="#fff" style={{ marginTop: 14 }}>
                  {queue === undefined ? "Sıra sistemi kapalı" : "Kimse beklemiyor"}
                </Txt>
                <Txt size={12.5} color={C.dim} align="center" lh={1.5} style={{ marginTop: 6, maxWidth: 250 }}>
                  {queue === undefined
                    ? "Mikrofona çıkmak isteyenler yakında burada sıraya girebilecek."
                    : "El kaldıran ilk kişi sen ol — oda sahibi onaylayınca mikrofona geçersin."}
                </Txt>
              </View>
            ) : (
              <ScrollView
                style={styles.liste}
                contentContainerStyle={styles.listeIc}
                showsVerticalScrollIndicator={false}
              >
                {liste.map((q, i) => {
                  const benim = q.uid === myUid;
                  const ilk = i === 0;
                  return (
                    <View key={q.uid} style={[styles.satir, benim && styles.satirBenim, ilk && styles.satirIlk]}>
                      <View style={[styles.sira, ilk && styles.siraIlk]}>
                        <Txt weight="displayBold" size={12.5} color={ilk ? "#241A05" : C.dim}>{i + 1}</Txt>
                      </View>

                      <Portrait name={q.name} size={44} photo={q.photo} />

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt weight="extrabold" size={14} color={benim ? C.gold2 : C.text} numberOfLines={1}>
                          {benim ? "Sen" : q.name}
                        </Txt>
                        {ilk && (
                          <Txt weight="bold" size={10} color={C.gold2} style={{ marginTop: 3, letterSpacing: 0.5 }}>
                            SIRADAKİ
                          </Txt>
                        )}
                      </View>

                      {canModerate ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Pressable
                            onPress={() => { haptic.success(); onApprove?.(q.uid); }}
                            style={styles.alBtn}
                            hitSlop={6}
                          >
                            <Icon name="mic" size={15} color="#052E20" />
                            <Txt weight="extrabold" size={13} color="#052E20">Al</Txt>
                          </Pressable>
                          <Pressable
                            onPress={() => { haptic.light(); onLower?.(q.uid); }}
                            style={styles.redBtn}
                            hitSlop={6}
                          >
                            <Icon name="x" size={16} color={C.dim} />
                          </Pressable>
                        </View>
                      ) : benim ? (
                        <Pressable onPress={() => { haptic.light(); onLower?.(q.uid); }} style={styles.vazgecBtn} hitSlop={6}>
                          <Txt weight="bold" size={12.5} color={C.dim}>Vazgeç</Txt>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Tek birincil aksiyon. Oda sahibinde hiç çizilmez (sıraya giremez). */}
            {altBarVar && (
              <View style={styles.altBar}>
                {alreadyOnMic ? (
                  /* Mikrofondayken buton PASİF görünür ama basılabilir kalır:
                     basınca sayfa kapanıp ekranın ortasına bilgilendirme
                     düşer. Butonu tamamen kaldırmak yerine böyle, çünkü
                     kullanıcı orada bir şey bekliyor — ne olduğunu söylemek
                     hiçbir şey göstermemekten iyi. */
                  <Pressable
                    onPress={() => { haptic.light(); onAlreadyOnMic?.(); }}
                    style={[styles.aksiyon, styles.aksiyonBilgi]}
                  >
                    <Icon name="mic" size={16} color={C.dim} />
                    <Txt weight="extrabold" size={14} color={C.dim}>Zaten mikrofondasın</Txt>
                  </Pressable>
                ) : (
                <Pressable
                  onPress={() => { haptic.light(); myRaised ? onLower?.() : onRaise?.(); }}
                  style={{ borderRadius: 15, overflow: "hidden" }}
                >
                  {myRaised ? (
                    <View style={[styles.aksiyon, styles.aksiyonPasif]}>
                      <Icon name="x" size={16} color={C.dim} />
                      <Txt weight="extrabold" size={14} color={C.dim}>Sıradan Çık</Txt>
                    </View>
                  ) : (
                    <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.aksiyon}>
                      <Icon name="hand" size={17} color="#241A05" />
                      <Txt weight="extrabold" size={14} color="#241A05">El Kaldır</Txt>
                    </Gradient>
                  )}
                </Pressable>
                )}
              </View>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.6)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    backgroundColor: "rgba(14,12,20,0.72)",
  },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.22)", alignSelf: "center", marginTop: 11 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16 },
  headIcon: {
    width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}44`,
  },
  kapatBtn: {
    width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: C.kartUst, borderWidth: 1, borderColor: C.line,
  },

  // Tek kişi varken de panel gibi dursun; kalabalıkta kaydırılsın.
  liste: { minHeight: 168, maxHeight: 360 },
  listeIc: { paddingHorizontal: 14, paddingBottom: 8, gap: 8 },

  satir: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: C.kart, borderWidth: 1, borderColor: "rgba(255,255,255,.07)",
  },
  satirIlk: { borderColor: `${C.gold}3D`, backgroundColor: `${C.gold}0F` },
  satirBenim: { borderColor: `${C.gold2}55` },
  sira: {
    width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
    backgroundColor: C.kontrol,
  },
  siraIlk: { backgroundColor: C.gold2 },

  alBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 13,
    backgroundColor: C.teal,   // temadan (#5EEAD4)
  },
  redBtn: {
    width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center",
    backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.1)",
  },
  vazgecBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 13,
    backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.1)",
  },

  bos: { alignItems: "center", justifyContent: "center", paddingHorizontal: 18, minHeight: 168 },
  bosIkon: {
    width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
    backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33`,
  },

  altBar: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 10 },
  aksiyon: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 15 },
  aksiyonPasif: { borderWidth: 1.5, borderColor: "rgba(255,255,255,.14)", backgroundColor: C.kontrol },
  // Pasif/"false" görünüm — basılabilir ama aksiyon vaat etmiyor.
  aksiyonBilgi: { borderWidth: 1.5, borderColor: "rgba(255,255,255,.12)", backgroundColor: C.kart },
});
