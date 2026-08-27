import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PNG_BADGE_IMG } from "@/components/PngBadge";
import { ROOM_BADGE_IMG } from "@/components/RoomBadges";
import { Txt } from "@/components/Txt";
import { getMyBadgeProgress, type RozetIlerleme } from "@/data/remote/badgeRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

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
  level: "Seviye Rütbeleri",
  role: "Roller",
  special: "Özel",
  room: "Başarılar",
};

function RozetKutu({ r }: { r: RozetIlerleme }) {
  const src = rozetGorseli(r.kod);
  const hedef = r.kural_esik ?? 0;
  const ilerleme = Math.min(r.ilerleme, hedef || r.ilerleme);
  const oran = hedef > 0 ? Math.min(1, r.ilerleme / hedef) : 0;

  return (
    <View style={styles.kutu}>
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
    </View>
  );
}

export default function BadgesScreen() {
  const router = useRouter();
  const [liste, setListe] = useState<RozetIlerleme[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) { setListe([]); return; }
      let alive = true;
      getMyBadgeProgress()
        .then((r) => { if (alive) { setListe(r); setHata(null); } })
        .catch((e) => { if (alive) { setListe([]); setHata(e?.message || "Rozetler yüklenemedi."); } });
      return () => { alive = false; };
    }, []),
  );

  const kazanilan = liste?.filter((r) => r.kazanildi).length ?? 0;
  const toplam = liste?.length ?? 0;
  const kategoriler = ["level", "role", "special", "room"];

  return (
    <View style={styles.root}>
      <Gradient colors={["#1B1430", "#08080C"]} deg={180} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
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
          <View style={styles.orta}><ActivityIndicator color={C.gold} /></View>
        ) : hata ? (
          <View style={styles.orta}>
            <Txt size={12.5} color={C.dim} align="center">{hata}</Txt>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            {kategoriler.map((kat) => {
              const grup = liste.filter((r) => r.kategori === kat);
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
                    {grup.map((r) => <RozetKutu key={r.kod} r={r} />)}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
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
});
