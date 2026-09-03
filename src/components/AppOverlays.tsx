import { usePathname, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Yukleniyor } from "@/components/Yukleniyor";
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
  /**
   * ALAN ALAN ABONE. Burası UYGULAMANIN HER EKRANININ üstünde duruyor
   * (küçültülmüş oda şeridi, efsanevi hediye duyurusu, giriş perdesi,
   * hesap yasağı bloğu). Seçicisiz `useApp()` TÜM store'a abone oluyordu:
   * 45 saniyede bir çalışan hesap yasağı yoklaması, biri odaya girip
   * çıktığında güncellenen oda listesi, XP değişimi — hepsi bu bileşeni ve
   * dolayısıyla üstünde durduğu ekranı yeniden çizdiriyordu.
   *
   * Aynı düzeltme `room.tsx`te daha önce yapılmıştı; kalan 11 yer de geçti.
   */
  const inRoom = useApp((s) => s.inRoom);
  const currentRoom = useApp((s) => s.currentRoom);
  const broadcast = useApp((s) => s.broadcast);
  const enterRoom = useApp((s) => s.enterRoom);
  const clearBroadcast = useApp((s) => s.clearBroadcast);
  const leaveRoom = useApp((s) => s.leaveRoom);
  const girisAdayi = useApp((s) => s.girisAdayi);
  const odayaGirDene = useApp((s) => s.odayaGirDene);
  const girisIptal = useApp((s) => s.girisIptal);
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
    return (
      <View style={styles.cover}>
        <Yukleniyor yazi="Hazırlanıyor" boyut={150} />
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
