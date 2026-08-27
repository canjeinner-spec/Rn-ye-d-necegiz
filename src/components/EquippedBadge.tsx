import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CenterModal } from "@/components/CenterModal";
import { PNG_BADGE_IMG } from "@/components/PngBadge";
import { ROOM_BADGE_IMG } from "@/components/RoomBadges";
import { Txt } from "@/components/Txt";
import { getBadgeCatalog, type RozetTanim } from "@/data/remote/badgeRepo";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";

const KATEGORI_ADI: Record<string, string> = {
  level: "Seviye Rütbesi",
  role: "Rol",
  special: "Özel Rozet",
  oda: "Oda Rozeti",
  basari: "Başarı",
};

/** kod -> görsel. level_/role_/special_ PngBadge'de, oda/başarı RoomBadges'te. */
function rozetGorseli(kod: string) {
  const png = PNG_BADGE_IMG as Record<string, number>;
  const room = ROOM_BADGE_IMG as Record<string, number>;
  return png[kod] ?? room[kod] ?? null;
}

/**
 * Kullanıcının kuşandığı rozet (kullanicilar.kusanilan_rozet).
 *
 * Tıklanınca adı ve AÇIKLAMASI açılır — açıklama katalogdan (`rozetler`
 * tablosu) gelir, uygulamada sabit bir metin listesi tutulmaz. Böylece yeni
 * rozet eklendiğinde açıklaması kendiliğinden görünür.
 *
 * Hem kendi profilinde hem başkasının gördüğü profilde aynı bileşen kullanılır.
 */
export function EquippedBadge({ kod, size = 28 }: { kod?: string | null; size?: number }) {
  const [acik, setAcik] = useState(false);
  const [tanim, setTanim] = useState<RozetTanim | null>(null);

  useEffect(() => {
    if (!acik || !kod || !isSupabaseConfigured) return;
    let alive = true;
    getBadgeCatalog()
      .then((m) => { if (alive) setTanim(m.get(kod) ?? null); })
      .catch(() => { if (alive) setTanim(null); });
    return () => { alive = false; };
  }, [acik, kod]);

  if (!kod) return null;
  const src = rozetGorseli(kod);
  if (!src) return null;

  return (
    <>
      <Pressable hitSlop={4} onPress={() => { haptic.light(); setAcik(true); }}>
        <Image source={src} style={{ width: size, height: size }} contentFit="contain" />
      </Pressable>

      <CenterModal visible={acik} onClose={() => setAcik(false)}>
        <View style={styles.kart}>
          <Image source={src} style={{ width: 88, height: 88 }} contentFit="contain" />
          <Txt weight="displayBold" size={17} color="#fff" align="center" style={{ marginTop: 12 }}>
            {tanim?.ad ?? "Rozet"}
          </Txt>
          {!!tanim?.kategori && (
            <Txt weight="bold" size={10.5} color={C.gold2} align="center" style={{ marginTop: 3, letterSpacing: 0.4 }}>
              {(KATEGORI_ADI[tanim.kategori] ?? tanim.kategori).toUpperCase()}
            </Txt>
          )}
          <Txt size={12.5} color={C.dim} lh={1.55} align="center" style={{ marginTop: 10 }}>
            {tanim?.aciklama ?? "Açıklama yükleniyor…"}
          </Txt>
        </View>
      </CenterModal>
    </>
  );
}

const styles = StyleSheet.create({
  kart: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: "#181620",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    alignItems: "center",
  },
});
