import { usePathname, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { AccountBanBlock } from "./AccountBanBlock";
import { GlobalBroadcast } from "./GlobalBroadcast";
import { MinimizedRoomBanner } from "./MinimizedRoomBanner";
import { RoomEntryGate } from "./RoomEntryGate";

export function AppOverlays() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { inRoom, currentRoom, broadcast, enterRoom, clearBroadcast, leaveRoom, girisAdayi, odayaGirDene, girisIptal } = useApp();
  const hesapYasak = useApp((s) => s.hesapYasak);
  const session = useApp((s) => s.session);
  const banChecked = useApp((s) => s.banChecked);

  const onRoom = pathname === "/room";

  // Hesap yasağı her şeyin üstünde — tam ekran engel (diğer overlay'ler gizli)
  if (hesapYasak) return <AccountBanBlock ban={hesapYasak} />;

  // Oturum var ama ilk yasak kontrolü henüz bitmedi → opak örtü. Yasaklı
  // kullanıcı bir an bile oda listesini görmesin; kontrol bitince ya blok
  // (yukarıda) ya da örtü kalkıp uygulama görünür.
  if (session && !banChecked) {
    console.log("[acilis] ORTU acik — yasak kontrolu bekleniyor");
    return (
      <View style={styles.cover}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  return (
    <>
      {inRoom && currentRoom && !onRoom && (
        <MinimizedRoomBanner
          room={currentRoom}
          bottom={92 + insets.bottom}
          onPress={() => router.navigate("/room")}
          // Şeritten doğrudan çıkış: önce odaya dönmek zorunda kalmasın.
          onLeave={leaveRoom}
        />
      )}
      {broadcast && (
        <GlobalBroadcast
          data={broadcast}
          // Durum çubuğunun dibindeydi, ekranın en tepesinde duruyordu.
          // Üst barın altına indi.
          top={insets.top + 56}
          onGo={() => {
            clearBroadcast();
            odayaGirDene(broadcast.room);
          }}
        />
      )}

      {/* Odaya giriş perdesi — hangi ekrandaysak onun üstünde açılır,
          kontroller geçerse odaya girilir. */}
      {girisAdayi && (
        <RoomEntryGate
          room={girisAdayi}
          onDevam={() => { enterRoom(girisAdayi); router.navigate("/room"); }}
          onVazgec={girisIptal}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, zIndex: 9998, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
});
