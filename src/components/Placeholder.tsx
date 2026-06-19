import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

export function Placeholder({ title, icon, note }: { title: string; icon: IconName; note?: string }) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Txt weight="extrabold" size={18} color="#fff">{title}</Txt>
        </View>
        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <Icon name={icon} size={34} color={C.dim} />
          </View>
          <Txt weight="bold" size={13} color={C.dim} style={{ marginTop: 14 }}>
            {note || "Bu ekran sonraki aşamada gelecek"}
          </Txt>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 18, paddingVertical: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  iconWrap: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
});
