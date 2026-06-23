import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { ROOMS, type Room } from "@/data/seed";
import { RoomPasswordGate } from "@/sheets/RoomPasswordGate";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { colors, gradients } from "@/theme/theme";
import { Gradient } from "@/theme/Gradient";

function RoomRow({ room, onPress }: { room: Room; onPress: () => void }) {
  const friendAvatars = room.crowd.slice(0, 3);
  const coverUri = room.photo || PEOPLE[room.host]?.photo;
  const tier: RoomTier | null = room.official ? "official" : room.daily != null ? "daily" : null;
  const tierBg = tier === "daily" ? gradients.tierDaily : gradients.tierOfficial;

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
            <Icon name="lock" size={10} color={colors.textInverse} />
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 7, marginRight: tier ? 6 : 0 }}>
        <Txt weight="extrabold" size={16} color={colors.textInverse} numberOfLines={1}>
          {room.name}
        </Txt>
        {room.badges && <RoomBadges badges={room.badges} size={17} />}
        <View style={[styles.metaRow, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
          <Txt weight="medium" size={11} color={colors.textSecondary}>Arkadaşlar</Txt>
          <View style={{ flexDirection: "row" }}>
            {friendAvatars.map((n, i) => (
              <View key={n} style={{ marginLeft: i ? -7 : 0, borderRadius: 11, borderWidth: 1.5, borderColor: colors.background }}>
                <Portrait name={n} size={18} />
              </View>
            ))}
          </View>
          <Txt weight="medium" size={11} color={colors.textSecondary}>{room.friends ?? room.crowd.length}</Txt>
        </View>
      </View>

      <View style={{ minWidth: tier ? 84 : undefined, alignItems: "flex-end", justifyContent: tier ? "flex-end" : "space-between", alignSelf: "stretch" }}>
        {!tier && (room.live ? (
          <Gradient colors={gradients.live} deg={135} style={styles.livePill}>
            <View style={styles.liveDot} />
            <Txt weight="extrabold" size={10} color={colors.textInverse}>Canlı</Txt>
          </Gradient>
        ) : (
          <View style={[styles.livePill, { backgroundColor: colors.scrim }]}>
            <Txt weight="extrabold" size={10} color={colors.textSecondary}>Yakında</Txt>
          </View>
        ))}
        <View style={[styles.metaRow, { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }]}>
          <Icon name="user" size={12} color={colors.textSecondary} />
          <Txt weight="medium" size={11} color={colors.textSecondary}>{room.online}</Txt>
          {room.live && <Eq color={colors.equalizer} />}
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
          <Pressable onPress={() => router.navigate("/preview")} hitSlop={10} style={{ width: 30 }}>
            <Icon name="search" size={20} color={colors.textSecondary} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Txt weight="displayBold" size={19} color={colors.textInverse} style={{ letterSpacing: 2 }}>ARON</Txt>
            <Txt weight="displayBold" size={19} color={colors.primary} style={{ letterSpacing: 2 }}>CHAT</Txt>
          </View>
          <View style={{ width: 30 }} />
        </View>

        <Tabs items={["Keşfet", "Popüler", "Yakında", "Takip Edilen"]} active={tab} set={setTab} />

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <EventBanners />
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {ROOMS.map((r) => (
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
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  // Zemin yok: satırlar listenin parçası gibi akar, aralarında ince ayırıcı çizgi.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  // Öne çıkan (resmi/günlük) odalar: ayırıcı yerine kendi boşluğu olan kart.
  rowSpecial: {
    overflow: "hidden",
    borderRadius: 18,
    paddingHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    borderBottomColor: colors.borderStrong,
  },
  crest: { position: "absolute", right: 6, top: -22 },
  // İkincil bilgi: daha sönük (yaklaşık %50 opaklık) → ana başlık öne çıkar.
  metaRow: { opacity: 0.5 },
  cover: { width: 62, height: 62, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  lockTag: { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textInverse },
});
