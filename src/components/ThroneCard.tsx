import { StyleSheet, View } from "react-native";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * Özel ID sahibi kartı ("taht").
 *
 * Eski hâlinde süslemeler emojiydi ve negatif konumlarla yerleştirilmişti:
 * 👑 ID etiketinin üstünde top:-14 ile duruyor, etiketin kendisi de
 * marginBottom:-6 ile kartın içine giriyordu — taç, etiket ve kart üst üste
 * biniyordu. 🪽 kanatlar da left/right:-30 ile kartın dışına taşıp
 * kırpılıyordu.
 *
 * Yeni düzen: koyu cam kart, altın kenar; taç ikon setinden gelen bir
 * madalyon olarak kartın üst kenarına oturuyor ve kendine ayrılmış boşluğu
 * var. Her parçanın yeri belli, hiçbir şey bir diğerinin üstüne binmiyor.
 */
export function ThroneCard({ id, name, big }: { id: string; name: string; big?: boolean }) {
  const av = big ? 84 : 62;
  const tac = big ? 36 : 28;

  return (
    <View style={{ width: "100%", alignItems: "center", paddingTop: tac / 2 }}>
      <View style={[styles.kart, { paddingTop: tac / 2 + (big ? 16 : 12) }]}>
        <Gradient colors={[C.gold + "2E", "transparent"]} deg={180} style={styles.ustIsik} pointerEvents="none" />
        <View style={styles.parilti} pointerEvents="none" />

        {/* Taç — kartın üst kenarına oturan madalyon, kendi boşluğu var */}
        <View style={[styles.tacYuva, { width: tac, height: tac, borderRadius: tac / 2, top: -tac / 2 }]}>
          <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={StyleSheet.absoluteFill} />
          <Icon name="crown" size={tac * 0.52} sw={2} color="#3A2A05" />
        </View>

        <View style={[styles.avatarRing, { width: av + 6, height: av + 6, borderRadius: (av + 6) / 2 }]}>
          <Portrait name={name} size={av} ring="transparent" />
        </View>

        <View style={styles.idPill}>
          <Txt weight="displayBold" size={big ? 13 : 11.5} color="#3A2A05">{id}</Txt>
        </View>

        <Txt weight="bold" size={big ? 12.5 : 11} color={C.text} numberOfLines={1} style={{ marginTop: 7, maxWidth: "100%" }}>
          {name}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderRadius: 20,
    backgroundColor: "rgba(22,18,12,.86)",
    borderWidth: 1.5,
    borderColor: C.gold + "5C",
    overflow: "visible",
  },
  ustIsik: { position: "absolute", top: 0, left: 0, right: 0, height: 88, borderTopLeftRadius: 19, borderTopRightRadius: 19 },
  parilti: { position: "absolute", top: 0, left: 30, right: 30, height: 1, backgroundColor: "rgba(255,255,255,.28)" },
  tacYuva: {
    position: "absolute",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#1B1610",
  },
  avatarRing: { overflow: "hidden", borderWidth: 2.5, borderColor: C.gold + "AA", alignItems: "center", justifyContent: "center" },
  idPill: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 3.5,
    paddingHorizontal: 14,
    backgroundColor: C.gold2,
  },
});
