import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppOverlays } from "@/components/AppOverlays";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { fontMap } from "@/theme/fonts";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts(fontMap);
  const initAuth = useApp((s) => s.initAuth);
  const bootstrapped = useApp((s) => s.bootstrapped);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (loaded && bootstrapped) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, bootstrapped]);

  // Fontlar + ilk oturum kontrolü bitene kadar splash açık kalır (flicker önler).
  if (!loaded || !bootstrapped) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar style="light" />
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: C.bg },
                animation: "slide_from_right",
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
              }}
            >
              <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="room"
                options={{ animation: "slide_from_bottom", gestureEnabled: true, gestureDirection: "vertical", fullScreenGestureEnabled: true }}
              />
            </Stack>
            <AppOverlays />
          </View>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
