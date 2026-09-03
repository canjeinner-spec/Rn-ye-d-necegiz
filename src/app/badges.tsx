import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CenterModal } from "@/components/CenterModal";
import { PNG_BADGE_IMG } from "@/components/PngBadge";
import { ROOM_BADGE_IMG } from "@/components/RoomBadges";
import { BosDurum } from "@/components/BosDurum";
import { Yukleniyor } from "@/components/Yukleniyor";
import { Txt } from "@/components/Txt";
import BOS_KUTU from "@/anim/bos-kutu.json";
import { equipBadge, getMyBadgeProgress, unequipBadge, type RozetIlerleme } from "@/data/remote/badgeRepo";
import { useApp } from "@/store/appStore";
import { Icon } from "@/icons/Icon";
import { getCached, setCached } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

/**
 * Rozet koleksiyonu — kazanılanlar renkli, kazanılmayanlar soluk ve
 * ilerlemeleriyle ("340/500"). Veri 049 migration'ındaki `rozet_ilerlemem`
 * RPC'sinden gelir; rozet `kod`'u PNG anahtarıyla birebir aynı.
 */

/** kod -> görsel. level_/role_/special_ PngBadge'de, gerisi oda rozetlerinde. */
function rozetGorseli(kod: string) {
  const png = PNG_BADGE_IMG as Record<string, number>;
  const room = ROOM_BADGE_IMG as Record<string, number>;
  return png[kod] ?? room[kod] ?? null;
}

const KATEGORI_ADI: Record<string, string> = {
  level: "Seviye Rütbelerim",
  special: "Özel",
  oda: "Oda Rozetlerim",
  basari: "Başarılarım",
};

/**
 * Kullanıcıya gösterilen kategoriler. `role` DIŞARIDA: rol rozetleri
 * (developer, admin, moderator…) kazanılan bir başarı değil, yetkiden gelir —
 * koleksiyonda "kilitli hedef" gibi görünmesi yanlış olur.
 */
const GORUNEN_KATEGORILER = ["level", "special", "oda", "basari"];

/** Kategori vurgu rengi — bilgi kartinin parilti ve etiketi. */
const KATEGORI_RENK: Record<string, string> = {
  level: "#F5B100",
  special: "#38BDF8",
  oda: "#5AA9FF",
  basari: "#4ADE80",
};

function RozetKutu({ r, kusanili, onPress }: { r: RozetIlerleme; kusanili: boolean; onPress: () => void }) {
  const src = rozetGorseli(r.kod);
  const hedef = r.kural_esik ?? 0;
  const ilerleme = Math.min(r.ilerleme, hedef || r.ilerleme);
  const oran = hedef > 0 ? Math.min(1, r.ilerleme / hedef) : 0;

  return (
    <Pressable
      onPress={() => { haptic.light(); onPress(); }}
      style={[styles.kutu, kusanili && styles.kutuKusanili]}
    >
      {kusanili && (
        <View style={styles.kusaniliRozet}>
          <Icon name="check" size={9} sw={3} color="#241A05" />
        </View>
      )}
      <View style={[styles.gorselAlan, !r.kazanildi && styles.kilitli]}>
        {src ? (
          <Image source={src} style={{ width: 54, height: 54 }} contentFit="contain" />
        ) : (
          <Icon name="shield" size={26} color={C.dim2} />
        )}
      </View>
      <Txt
        weight={r.kazanildi ? "extrabold" : "semibold"}
        size={10.5}
        color={r.kazanildi ? C.text : C.dim}
        numberOfLines={1}
        align="center"
        style={{ marginTop: 6, width: "100%" }}
      >
        {r.ad}
      </Txt>

      {r.kazanildi ? (
        <View style={styles.kazanildiPill}>
          <Icon name="check" size={9} sw={3} color={C.green} />
          <Txt weight="extrabold" size={8.5} color={C.green}>KAZANILDI</Txt>
        </View>
      ) : r.kural_metrik && hedef > 0 ? (
        <View style={{ width: "100%", marginTop: 5 }}>
          <View style={styles.barZemin}>
            <View style={[styles.barDolu, { width: `${Math.round(oran * 100)}%` }]} />
          </View>
          <Txt weight="bold" size={8.5} color={C.dim2} align="center" style={{ marginTop: 3 }}>
            {ilerleme}/{hedef}
          </Txt>
        </View>
      ) : (
        <Txt weight="semibold" size={8.5} color={C.dim2} align="center" style={{ marginTop: 5 }}>
          Etkinlikle kazanılır
        </Txt>
      )}
    </Pressable>
  );
}

export default function BadgesScreen() {
  const router = useRouter();
  /**
   * ÖNBELLEKTEN TOHUMLA. Ekran her açılışta sıfırdan yükleniyordu; rozet
   * sayfası profilden sık açılıyor ve her seferinde boş→dolu titremesi
   * oluyordu. Son liste anında çiziliyor, arkada tazeleniyor.
   * (Önbellek çıkışta siliniyor — bkz. `cacheTemizle`.)
   */
  const [liste, setListe] = useState<RozetIlerleme[] | null>(() => getCached<RozetIlerleme[]>("rozet:ilerleme") ?? null);
  const [hata, setHata] = useState<string | null>(null);
  const [secili, setSecili] = useState<RozetIlerleme | null>(null);
  const [islemde, setIslemde] = useState(false);
  const kusanilanRozet = useApp((s) => s.kusanilanRozet);
  const setKusanilanRozet = useApp((s) => s.setKusanilanRozet);

  const kusan = async (r: RozetIlerleme) => {
    if (islemde) return;
    setIslemde(true);
    const kaldir = kusanilanRozet === r.kod;
    const onceki = kusanilanRozet;
    setKusanilanRozet(kaldir ? null : r.kod); // iyimser güncelleme
    try {
      if (kaldir) await unequipBadge();
      else await equipBadge(r.kod);
      haptic.success();
      setSecili(null);
    } catch (e: any) {
      setKusanilanRozet(onceki); // geri al
      setHata(e?.message || "Rozet kuşanılamadı.");
    } finally {
      setIslemde(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) { setListe([]); return; }
      let alive = true;
      getMyBadgeProgress()
        .then((r) => { if (alive) { setListe(r); setCached("rozet:ilerleme", r, true); setHata(null); } })
        .catch((e) => { if (alive) { setListe([]); setHata(e?.message || "Rozetler yüklenemedi."); } });
      return () => { alive = false; };
    }, []),
  );

  // Rol rozetleri koleksiyonda gösterilmez; sayaç da onları saymaz.
  const gosterilen = liste?.filter((r) => GORUNEN_KATEGORILER.includes(r.kategori ?? "")) ?? [];
  const kazanilan = gosterilen.filter((r) => r.kazanildi).length;
  const toplam = gosterilen.length;

  return (
    <View style={styles.root}>
      <Zemin />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => { haptic.light(); router.back(); }} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Rozetlerim</Txt>
          <View style={{ flex: 1 }} />
          {liste && (
            <View style={styles.sayacPill}>
              <Txt weight="extrabold" size={11} color={C.gold2}>{kazanilan}/{toplam}</Txt>
            </View>
          )}
        </View>

        {liste === null ? (
          <Yukleniyor tamEkran yazi="Rozetler yükleniyor" />
        ) : hata ? (
          <View style={styles.orta}>
            <Txt size={12.5} color={C.dim} align="center">{hata}</Txt>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            {/* Her kategori için aşağıda `if (!grup.length) return null` var; hepsi
                boşsa ekran BOMBOŞ kalıyordu, hiçbir açıklama yoktu. */}
            {gosterilen.length === 0 && (
              <BosDurum
                anim={BOS_KUTU}
                baslik="Henüz rozetin yok"
                alt="Odalarda aktif oldukça ve görevleri tamamladıkça rozetler burada birikir."
              />
            )}
            {GORUNEN_KATEGORILER.map((kat) => {
              const grup = gosterilen.filter((r) => r.kategori === kat);
              if (!grup.length) return null;
              const gKazanilan = grup.filter((r) => r.kazanildi).length;
              return (
                <View key={kat} style={{ marginTop: 18 }}>
                  <View style={styles.baslikSatir}>
                    <Txt weight="extrabold" size={11} color={C.dim} style={{ letterSpacing: 0.5, flex: 1 }}>
                      {(KATEGORI_ADI[kat] ?? kat).toUpperCase()}
                    </Txt>
                    <Txt weight="bold" size={10.5} color={C.dim2}>{gKazanilan}/{grup.length}</Txt>
                  </View>
                  <View style={styles.izgara}>
                    {grup.map((r) => (
                      <RozetKutu
                        key={r.kod}
                        r={r}
                        kusanili={kusanilanRozet === r.kod}
                        onPress={() => setSecili(r)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Rozet açıklaması + kuşanma */}
      <CenterModal visible={!!secili} onClose={() => setSecili(null)}>
        {secili && (
          <BlurView intensity={22} tint="dark" style={styles.modal}>
            {/* Diğer rozet kartlarıyla aynı liquid-glass dili: üstten renk
                geçişi, ince parlama çizgisi, rozetin arkasında renkli parıltı. */}
            <Gradient colors={[KATEGORI_RENK[secili.kategori ?? ""] + "24", "transparent"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.sheen} pointerEvents="none" />

            <View
              style={[
                styles.modalGorsel,
                {
                  backgroundColor: KATEGORI_RENK[secili.kategori ?? ""] + "1F",
                  shadowColor: KATEGORI_RENK[secili.kategori ?? ""],
                },
                !secili.kazanildi && styles.kilitli,
              ]}
            >
              {rozetGorseli(secili.kod) ? (
                <Image source={rozetGorseli(secili.kod)!} style={{ width: 80, height: 80 }} contentFit="contain" />
              ) : (
                <Icon name="shield" size={40} color={C.dim2} />
              )}
            </View>
            <Txt weight="extrabold" size={17} color="#fff" align="center" style={{ marginTop: 11 }}>
              {secili.ad}
            </Txt>
            <View style={[styles.katPill, { borderColor: KATEGORI_RENK[secili.kategori ?? ""] + "66", backgroundColor: KATEGORI_RENK[secili.kategori ?? ""] + "22" }]}>
              <Txt weight="bold" size={10} color="#fff" style={{ letterSpacing: 0.5 }}>
                {(KATEGORI_ADI[secili.kategori ?? ""] ?? "ROZET").toUpperCase()}
              </Txt>
            </View>
            <Txt size={12} color="rgba(255,255,255,.9)" lh={1.5} align="center" style={{ marginTop: 9 }}>
              {secili.aciklama || "Bu rozet için açıklama yok."}
            </Txt>

            {!secili.kazanildi && secili.kural_esik ? (
              <Txt weight="bold" size={11.5} color={C.dim2} align="center" style={{ marginTop: 10 }}>
                İlerleme: {Math.min(secili.ilerleme, secili.kural_esik)}/{secili.kural_esik}
              </Txt>
            ) : null}

            {/* Seviye rütbeleri kuşanılamaz/çıkarılamaz — seviyeyi sistem
                belirler, kullanıcı seçimi değildir. */}
            {secili.kategori === "level" ? (
              <View style={[styles.cikarBtn, { alignSelf: "stretch", marginTop: 16 }]}>
                <Icon name="shield" size={13} color={C.dim2} />
                <Txt weight="bold" size={12} color={C.dim2}>Seviyeni sistem belirler</Txt>
              </View>
            ) : secili.kazanildi ? (
              <Pressable
                onPress={() => kusan(secili)}
                disabled={islemde}
                style={{ alignSelf: "stretch", marginTop: 16, borderRadius: 14, overflow: "hidden", opacity: islemde ? 0.6 : 1 }}
              >
                {kusanilanRozet === secili.kod ? (
                  <View style={styles.cikarBtn}>
                    <Txt weight="extrabold" size={13} color={C.dim}>Kuşanmayı Kaldır</Txt>
                  </View>
                ) : (
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.kusanBtn}>
                    <Txt weight="extrabold" size={13} color="#241A05">Bu Rozeti Kuşan</Txt>
                  </Gradient>
                )}
              </Pressable>
            ) : (
              <View style={[styles.cikarBtn, { alignSelf: "stretch", marginTop: 16 }]}>
                <Icon name="lock" size={13} color={C.dim2} />
                <Txt weight="bold" size={12.5} color={C.dim2}>Henüz kazanılmadı</Txt>
              </View>
            )}
          </BlurView>
        )}
      </CenterModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  sayacPill: { paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}44` },
  orta: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  baslikSatir: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingHorizontal: 2 },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kutu: {
    width: "23.5%",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,.035)",
    borderWidth: 1,
    borderColor: C.line,
  },
  gorselAlan: { width: 54, height: 54, alignItems: "center", justifyContent: "center" },
  /** Kazanılmamış rozet: soluk ve gri */
  kilitli: { opacity: 0.28 },
  kazanildiPill: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 5, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 999, backgroundColor: `${C.green}14` },
  barZemin: { height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,.10)", overflow: "hidden" },
  barDolu: { height: 4, borderRadius: 999, backgroundColor: C.gold },
  /** Kuşanılan rozetin kutusu — altın çerçeve + köşe işareti */
  kutuKusanili: { borderColor: C.gold, backgroundColor: `${C.gold}12` },
  kusaniliRozet: {
    position: "absolute", top: 5, right: 5, width: 15, height: 15, borderRadius: 999,
    backgroundColor: C.gold, alignItems: "center", justifyContent: "center", zIndex: 2,
  },
  modal: { borderRadius: 22, overflow: "hidden", paddingTop: 18, paddingBottom: 15, paddingHorizontal: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.18)", backgroundColor: "rgba(16,14,22,.30)" },
  modalGorsel: { width: 92, height: 92, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", shadowOpacity: 0.85, shadowRadius: 18, shadowOffset: { width: 0, height: 4 } },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,.28)" },
  katPill: { marginTop: 8, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  kusanBtn: { paddingVertical: 13, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cikarBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: C.line,
  },
});
