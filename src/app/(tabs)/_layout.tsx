import { Redirect, Tabs } from "expo-router";

import { BottomNav } from "@/components/BottomNav";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";

export default function TabsLayout() {
  const girisYapildi = useApp((s) => s.girisYapildi);
  if (!girisYapildi) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        animation: "shift",
        lazy: false,
        freezeOnBlur: false,
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
