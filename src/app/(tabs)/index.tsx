import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Eq } from "@/components/Eq";
import { Pill } from "@/components/Pill";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { ROOMS, type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";

function RoomCard({ room, onPress }: { room: Room; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Scene kind={room.scene} />
      <View style={styles.cardTop}>
        {room.live ? (
          <Pill bg="rgba(248,113,113,.22)" color={C.red} border={C.red + "55"}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Eq color={C.red} />
              <Txt weight="extrabold" size={9} color={C.red}>CANLI</Txt>
            </View>
          </Pill>
        ) : (
          <Pill bg="rgba(255,255,255,.1)" color={C.dim}>YAKINDA</Pill>
        )}
        {room.official && (
          <Pill bg="rgba(232,179,65,.2)" color={C.gold2} border={C.gold + "55"}>RESMİ</Pill>
        )}
      </View>
      <View style={styles.cardBottom}>
        <Txt weight="extrabold" size={14} color="#fff" numberOfLines={1}>
          {room.name}
        </Txt>
        <View style={styles.cardMeta}>
          <Portrait name={room.host} size={20} />
          <Txt weight="semibold" size={11} color="rgba(255,255,255,.8)">{room.host}</Txt>
          <View style={{ flex: 1 }} />
          <Icon name="users" size={13} color={C.dim} />
          <Txt weight="bold" size={11} color={C.dim}>{room.online}</Txt>
        </View>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const enterRoom = useApp((s) => s.enterRoom);

  const open = (room: Room) => {
    enterRoom(room);
    router.navigate("/room");
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt weight="displayBold" size={22} color={C.gold} style={{ letterSpacing: 1 }}>ARON</Txt>
            <Txt weight="semibold" size={11} color={C.dim} style={{ letterSpacing: 3 }}>CHAT</Txt>
          </View>
          <Pressable onPress={() => router.navigate("/preview")} style={styles.devChip}>
            <Txt weight="bold" size={10} color={C.dim}>önizleme</Txt>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 120, gap: 12 }}>
          {ROOMS.map((r) => (
            <RoomCard key={r.id} room={r} onPress={() => open(r)} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12 },
  devChip: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  card: { height: 150, borderRadius: 20, overflow: "hidden", justifyContent: "space-between", borderWidth: 1, borderColor: C.line },
  cardTop: { flexDirection: "row", gap: 8, padding: 12 },
  cardBottom: { padding: 14, gap: 8 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
});
