import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Eq } from "@/components/Eq";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { ROOMS } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";

export default function RoomScreen() {
  const router = useRouter();
  const { currentRoom, leaveRoom, fireBroadcast } = useApp();
  const room = currentRoom;

  const minimize = () => router.back();
  const leave = () => {
    leaveRoom();
    router.back();
  };
  const testBroadcast = () => {
    if (!room) return;
    fireBroadcast({
      sender: room.host,
      recipient: "Herkese",
      qty: 1,
      room,
      gift: { tier: "legendary", emoji: "🐉", name: "Ejderha" },
    });
  };

  if (!room) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Txt color={C.dim}>Oda bulunamadı</Txt>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Scene kind={room.scene} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <View style={styles.roomChip}>
            <View style={styles.thumb}>
              <Scene kind={room.scene} />
            </View>
            <View style={{ minWidth: 0 }}>
              <Txt weight="extrabold" size={12.5} color="#fff" numberOfLines={1}>{room.name}</Txt>
              <Txt weight="semibold" size={9.5} color="rgba(255,255,255,.5)">ID: {room.id}</Txt>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable onPress={minimize}><Icon name="minimize" size={21} color="#fff" /></Pressable>
            <Pressable onPress={leave}><Icon name="power" size={21} color="#fff" /></Pressable>
          </View>
        </View>

        <View style={styles.center}>
          <View style={{ alignItems: "center", gap: 10 }}>
            <Portrait name={room.host} size={92} ring={C.gold} glow online />
            <Txt weight="extrabold" size={16} color="#fff">{room.host}</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Eq />
              <Txt weight="bold" size={12} color={C.gold2}>Oda içi · Aşama 3'te tamamlanacak</Txt>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={testBroadcast} style={[styles.btn, { borderColor: C.gold + "55" }]}>
            <Icon name="gift" size={16} color={C.gold2} />
            <Txt weight="bold" size={12} color={C.gold2}>Test: global hediye şeridi</Txt>
          </Pressable>
          <Pressable onPress={minimize} style={styles.btn}>
            <Icon name="minimize" size={16} color={C.dim} />
            <Txt weight="bold" size={12} color={C.dim}>Küçült (banner görünür)</Txt>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 6, gap: 10 },
  roomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 13,
    borderRadius: 14,
    maxWidth: "66%",
    backgroundColor: "rgba(0,0,0,.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
  },
  thumb: { width: 38, height: 38, borderRadius: 10, overflow: "hidden" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  actions: { paddingHorizontal: 16, gap: 10, paddingBottom: 10 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "rgba(20,18,28,0.6)",
  },
});
