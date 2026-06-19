import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/store/appStore";
import { GlobalBroadcast } from "./GlobalBroadcast";
import { MinimizedRoomBanner } from "./MinimizedRoomBanner";

export function AppOverlays() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { inRoom, currentRoom, broadcast, enterRoom, clearBroadcast } = useApp();

  const onRoom = pathname === "/room";

  return (
    <>
      {inRoom && currentRoom && !onRoom && (
        <MinimizedRoomBanner
          room={currentRoom}
          bottom={92 + insets.bottom}
          onPress={() => router.navigate("/room")}
        />
      )}
      {broadcast && (
        <GlobalBroadcast
          data={broadcast}
          top={insets.top + 6}
          onGo={() => {
            enterRoom(broadcast.room);
            clearBroadcast();
            router.navigate("/room");
          }}
        />
      )}
    </>
  );
}
