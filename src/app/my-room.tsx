import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { PEOPLE } from "@/data/people";
import { ROOMS, type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const TABS = ["Son günlerde", "Katıl", "Takip et"];

function RoomCard({ room, onPress }: { room: Room; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardThumb}>
        {(room.photo || PEOPLE[room.host]?.photo) ? <Image source={{ uri: room.photo || PEOPLE[room.host]?.photo || "" }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Txt weight="extrabold" size={14} color={C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{room.name}</Txt>
          {room.locked && <Icon name="lock" size={12} color={C.dim2} />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 }}>
          <View style={{ flexDirection: "row" }}>
            {room.crowd.slice(0, 4).map((n, i) => (
              <View key={n + i} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: 11, borderWidth: 2, borderColor: "#15131C" }}>
                <Portrait name={n} size={22} />
              </View>
            ))}
          </View>
          <Txt weight="bold" size={11} color={C.dim}>{room.online}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon path="M4 12h2M9 7v10M14 4v16M19 9v6" size={15} color={C.green} />
        <Txt weight="extrabold" size={12} color={C.green}>{room.extra + room.mic}</Txt>
      </View>
    </Pressable>
  );
}

export default function MyRoomHub() {
  const router = useRouter();
  const { myRoom, userName, userPhoto, openMyRoom, enterRoom } = useApp();
  const [tab, setTab] = useState(0);

  const live = ROOMS.filter((r) => r.live && !r.official);
  const lists = [live, live.slice(0, 3), live.slice(1, 4)];
  const list = lists[tab];

  const enterMine = () => {
    haptic.light();
    openMyRoom();
    router.navigate("/room");
  };
  const openRoom = (r: Room) => {
    haptic.light();
    enterRoom(r);
    router.navigate("/room");
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={17} color="#fff">Odam</Txt>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Txt weight="extrabold" size={12} color={C.dim} style={{ marginBottom: 8, letterSpacing: 0.3 }}>ODAM</Txt>
          <Pressable onPress={enterMine} style={styles.mineCard}>
            <View style={styles.mineThumb}>
              {(myRoom?.photo || userPhoto) ? <Image source={{ uri: myRoom?.photo || userPhoto || "" }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind="club" />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="extrabold" size={15} color="#fff" numberOfLines={1}>{myRoom ? myRoom.name : `${userName} Odası`}</Txt>
              <Txt weight="semibold" size={11.5} color="#C4B5FD" style={{ marginTop: 4 }}>{myRoom ? "Odana geri dön" : "Henüz odan yok — oluşturmak için dokun"}</Txt>
            </View>
            <Gradient colors={["#A855F7", "#6D28D9"]} deg={135} style={styles.mineBtn}>
              <Txt weight="extrabold" size={12.5} color="#fff">{myRoom ? "Gir" : "Oluştur"}</Txt>
              <Icon name="chev" size={13} color="#fff" />
            </Gradient>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginBottom: 14 }}>
            {TABS.map((t, i) => (
              <Pressable key={t} onPress={() => setTab(i)} style={{ paddingBottom: 7 }}>
                <Txt weight={i === tab ? "extrabold" : "semibold"} size={i === tab ? 16 : 14.5} color={i === tab ? C.text : C.dim2}>{t}</Txt>
                {i === tab && <View style={styles.tabUnderline} />}
              </Pressable>
            ))}
          </View>

          {list.map((r) => <RoomCard key={r.id} room={r} onPress={() => openRoom(r)} />)}
          {list.length === 0 && <Txt size={12.5} color={C.dim} align="center" style={{ paddingVertical: 50 }}>Burada gösterilecek oda yok.</Txt>}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  mineCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, marginBottom: 22, overflow: "hidden", backgroundColor: "rgba(124,58,237,.1)", borderWidth: 1, borderColor: "rgba(168,85,247,.3)" },
  mineThumb: { width: 66, height: 66, borderRadius: 17, overflow: "hidden" },
  mineBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999 },
  tabUnderline: { position: "absolute", bottom: 0, left: 0, width: 26, height: 3, borderRadius: 3, backgroundColor: C.green },
  card: { flexDirection: "row", alignItems: "center", gap: 13, padding: 12, borderRadius: 18, marginBottom: 12, backgroundColor: "#15131C", borderWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  cardThumb: { width: 62, height: 62, borderRadius: 15, overflow: "hidden" },
});
