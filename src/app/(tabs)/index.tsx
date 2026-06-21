import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Eq } from "@/components/Eq";
import { EventBanners } from "@/components/EventBanners";
import { Portrait } from "@/components/Portrait";
import { RoomBadges } from "@/components/RoomBadges";
import { RoomCrest, RoomTopTag, type RoomTier } from "@/components/RoomTopTag";
import { Scene } from "@/components/Scene";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { PEOPLE } from "@/data/people";
import { listRooms } from "@/data/remote/roomsRepo";
import { ROOMS, type Room } from "@/data/seed";
import { RoomPasswordGate } from "@/sheets/RoomPasswordGate";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

function RoomRow({ room, onPress }: { room: Room; onPress: () => void }) {
  const friendAvatars = room.crowd.slice(0, 3);
  const coverUri = room.photo || PEOPLE[room.host]?.photo;
  const tier: RoomTier | null = room.official ? "official" : room.daily != null ? "daily" : null;
  const tierBg = tier === "daily" ? (["#3A2A66", "#221A42"] as const) : (["#1E2A52", "#162038"] as const);

  return (
    <Pressable onPress={onPress} style={[styles.row, tier && styles.rowSpecial]}>
      {tier && <Gradient colors={tierBg} deg={135} style={StyleSheet.absoluteFill} pointerEvents="none" />}
      {tier && (
        <View style={styles.crest} pointerEvents="none">
          <RoomCrest kind={tier} />
        </View>
      )}
      {tier && <RoomTopTag kind={tier} rank={room.daily ?? 1} />}

      <View style={styles.cover}>
        {coverUri ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
        {room.locked && (
          <View style={styles.lockTag}>
            <Icon name="lock" size={10} color="#fff" />
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 5, marginRight: tier ? 6 : 0 }}>
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

      <View style={{ minWidth: tier ? 84 : undefined, alignItems: "flex-end", justifyContent: tier ? "flex-end" : "space-between", alignSelf: "stretch" }}>
        {!tier && (room.live ? (
          <Gradient colors={["#8B5CF6", "#6D28D9"]} deg={135} style={styles.livePill}>
            <View style={styles.liveDot} />
            <Txt weight="extrabold" size={10} color="#fff">Canlı</Txt>
          </Gradient>
        ) : (
          <View style={[styles.livePill, { backgroundColor: "rgba(255,255,255,.08)" }]}>
            <Txt weight="extrabold" size={10} color={C.dim}>Yakında</Txt>
          </View>
        ))}
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
  const role = useApp((s) => s.role);
  const privileged = role !== "user";
  const [tab, setTab] = useState(0);
  const [gateRoom, setGateRoom] = useState<Room | null>(null);
  const [dbRooms, setDbRooms] = useState<Room[]>([]);

  // Gerçek odaları DB'den yükle; ekrana her dönüşte tazele (yeni açılan oda görünsün).
  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      let alive = true;
      listRooms().then((r) => { if (alive) setDbRooms(r); }).catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  // DB odaları üstte; mock odalar (MVP'de ekranı canlı tutar) altta. Aynı ID tekrarını ele.
  const dbIds = new Set(dbRooms.map((r) => r.id));
  const rooms = [...dbRooms, ...ROOMS.filter((r) => !dbIds.has(r.id))];

  const enterAndGo = (room: Room) => {
    haptic.light();
    enterRoom(room);
    router.navigate("/room");
  };
  const onRoomPress = (room: Room) => {
    haptic.light();
    // developer / süper admin kilitli odaya şifresiz girer
    if (room.locked && !privileged) setGateRoom(room);
    else enterAndGo(room);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <View style={{ width: 38 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Txt weight="displayBold" size={19} color="#fff" style={{ letterSpacing: 2 }}>ARON</Txt>
            <Txt weight="displayBold" size={19} color={C.gold} style={{ letterSpacing: 2 }}>CHAT</Txt>
          </View>
          <Pressable onPress={() => router.navigate("/preview")} hitSlop={8} style={styles.roundBtn}>
            <Icon name="search" size={19} color={C.text} />
          </Pressable>
        </View>

        <Tabs items={["Keşfet", "Popüler", "Yakında", "Takip Edilen"]} active={tab} set={setTab} />

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <EventBanners />
          <View style={{ paddingHorizontal: 12, paddingTop: 14, gap: 10 }}>
            {rooms.map((r) => (
              <RoomRow key={r.id} room={r} onPress={() => onRoomPress(r)} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      {gateRoom && (
        <RoomPasswordGate
          room={gateRoom}
          onClose={() => setGateRoom(null)}
          onPass={() => { const r = gateRoom; setGateRoom(null); enterAndGo(r); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  roundBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
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
  rowSpecial: { overflow: "hidden", borderColor: "rgba(255,255,255,.12)" },
  crest: { position: "absolute", right: 6, top: -22 },
  cover: { width: 62, height: 62, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  lockTag: { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
});
