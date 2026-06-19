import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Eq } from "@/components/Eq";
import { Portrait } from "@/components/Portrait";
import { RoomBadges } from "@/components/RoomBadges";
import { Scene } from "@/components/Scene";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { ROOMS, type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

function RoomRow({ room, onPress }: { room: Room; onPress: () => void }) {
  const friendAvatars = room.crowd.slice(0, 3);
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.cover}>
        {room.photo ? <Image source={{ uri: room.photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
        {room.locked && (
          <View style={styles.lockTag}>
            <Icon name="lock" size={10} color="#fff" />
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Txt weight="extrabold" size={14} color="#fff" numberOfLines={1}>
          {room.name}
        </Txt>
        {room.badges && <RoomBadges badges={room.badges} size={17} />}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Txt weight="semibold" size={10.5} color={C.dim}>Arkadaşlar</Txt>
          <View style={{ flexDirection: "row" }}>
            {friendAvatars.map((n, i) => (
              <View key={n} style={{ marginLeft: i ? -7 : 0, borderRadius: 11, borderWidth: 1.5, borderColor: "#15121C" }}>
                <Portrait name={n} size={18} />
              </View>
            ))}
          </View>
          <Txt weight="bold" size={10.5} color={C.dim2}>{room.friends ?? room.crowd.length}</Txt>
        </View>
      </View>

      <View style={{ alignItems: "flex-end", justifyContent: "space-between", alignSelf: "stretch" }}>
        {room.live ? (
          <Gradient colors={["#8B5CF6", "#6D28D9"]} deg={135} style={styles.livePill}>
            <View style={styles.liveDot} />
            <Txt weight="extrabold" size={10} color="#fff">Canlı</Txt>
          </Gradient>
        ) : (
          <View style={[styles.livePill, { backgroundColor: "rgba(255,255,255,.08)" }]}>
            <Txt weight="extrabold" size={10} color={C.dim}>Yakında</Txt>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
          <Icon name="user" size={12} color={C.dim2} />
          <Txt weight="bold" size={10.5} color={C.dim}>{room.online}</Txt>
          {room.live && <Eq color="#F59E0B" />}
        </View>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const enterRoom = useApp((s) => s.enterRoom);
  const [tab, setTab] = useState(0);

  const open = (room: Room) => {
    enterRoom(room);
    router.navigate("/room");
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.navigate("/preview")} hitSlop={10} style={{ width: 30 }}>
            <Icon name="search" size={20} color={C.dim} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Txt weight="displayBold" size={19} color="#fff" style={{ letterSpacing: 2 }}>ARON</Txt>
            <Txt weight="displayBold" size={19} color={C.gold} style={{ letterSpacing: 2 }}>CHAT</Txt>
          </View>
          <Pressable hitSlop={10} style={{ width: 30, alignItems: "flex-end" }}>
            <Icon name="plus" size={22} color={C.gold} />
          </Pressable>
        </View>

        <Tabs items={["Keşfet", "Popüler", "Yakında", "Takip Edilen"]} active={tab} set={setTab} />

        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 120, gap: 10 }} showsVerticalScrollIndicator={false}>
          {ROOMS.map((r) => (
            <RoomRow key={r.id} room={r} onPress={() => open(r)} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: "rgba(28,22,40,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.06)",
  },
  cover: { width: 62, height: 62, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  lockTag: { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
});
