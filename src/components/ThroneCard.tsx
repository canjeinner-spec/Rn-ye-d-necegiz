import { StyleSheet, View } from "react-native";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export function ThroneCard({ id, name, big }: { id: string; name: string; big?: boolean }) {
  const av = big ? 92 : 70;
  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <View style={styles.idTag}>
        {big && <Txt size={15} style={{ position: "absolute", top: -14, alignSelf: "center" }}>👑</Txt>}
        <Txt weight="displayBold" size={13} color={C.gold2}>{id}</Txt>
      </View>
      <Gradient colors={["#F5CE6E", "#9A6B1C"]} deg={160} style={[styles.throne, { paddingTop: big ? 18 : 14 }]}>
        <View style={{ alignItems: "center" }}>
          <View style={{ position: "relative" }}>
            {big && (
              <>
                <Txt size={30} style={styles.wingL}>🪽</Txt>
                <Txt size={30} style={styles.wingR}>🪽</Txt>
              </>
            )}
            <View style={[styles.avatarRing, { width: av + 6, height: av + 6, borderRadius: (av + 6) / 2 }]}>
              <Portrait name={name} size={av} ring="transparent" />
            </View>
          </View>
        </View>
        <View style={styles.plate}>
          <Txt weight="displayBold" size={big ? 13 : 11.5} color="#FFF3D4" numberOfLines={1}>{name}</Txt>
        </View>
      </Gradient>
    </View>
  );
}

const styles = StyleSheet.create({
  idTag: { zIndex: 2, marginBottom: -6, backgroundColor: "#241805", borderWidth: 1.5, borderColor: `${C.gold}66`, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 18 },
  throne: { width: "100%", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 12, paddingBottom: 12, borderWidth: 2, borderColor: C.gold2 },
  wingL: { position: "absolute", left: -30, top: "30%" },
  wingR: { position: "absolute", right: -30, top: "30%", transform: [{ scaleX: -1 }] },
  avatarRing: { overflow: "hidden", borderWidth: 3, borderColor: "#FFF3D4", alignItems: "center", justifyContent: "center" },
  plate: { marginTop: 10, backgroundColor: "rgba(40,26,5,.5)", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8, alignItems: "center" },
});
