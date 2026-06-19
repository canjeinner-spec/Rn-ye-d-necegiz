import { Tabs } from "expo-router";

import { BottomNav } from "@/components/BottomNav";
import { C } from "@/theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        animation: "shift",
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="rank" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="dm" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
