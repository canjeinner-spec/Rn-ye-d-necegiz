import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useRouter, useSegments } from "expo-router";
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

/**
 * Tek güvenilir auth navigasyon sürücüsü. Bir `useEffect` içinde çalışır
 * (render sonrası, navigasyon ağacı commit olduktan sonra) — böylece Google
 * OAuth dönüşünde (uygulama arka plandan resume olurken) düşmez. Eskiden
 * navigasyon dağınık `<Redirect>` + handler içi imperatif `router.replace`
 * ile yapılıyordu ve resume sırasında yutuluyordu (kullanıcı girişten sonra
 * içeri giremiyordu; ancak kapat-aç sonrası giriyordu).
 */
function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const bootstrapped = useApp((s) => s.bootstrapped);
  const girisYapildi = useApp((s) => s.girisYapildi);
  const profilEksik = useApp((s) => s.profilEksik);
  const hesapYasak = useApp((s) => s.hesapYasak);

  useEffect(() => {
    console.log(`[acilis] AuthGate boot=${bootstrapped} giris=${girisYapildi} profilEksik=${profilEksik} yol=${segments[0] ?? "/"}`);
    if (!bootstrapped || hesapYasak) return; // hesap yasağı → AppOverlays tam ekran engel
    const onOnboarding = segments[0] === "onboarding";
    if (!girisYapildi) {
      if (!onOnboarding) router.replace("/onboarding");
      return;
    }
    // Girişli. profilEksik null = henüz yüklenmedi → bekle (flicker olmasın).
    if (profilEksik === false && onOnboarding) router.replace("/(tabs)");
    else if (profilEksik === true && !onOnboarding) router.replace("/onboarding");
  }, [bootstrapped, girisYapildi, profilEksik, hesapYasak, segments, router]);

  return null;
}

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
            <AuthGate />
            <AppOverlays />
          </View>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
