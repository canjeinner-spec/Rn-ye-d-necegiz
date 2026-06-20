import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { CoinBadge } from "@/components/Coins";
import { FramePreview } from "@/components/FramePreview";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { STORE_FRAMES, type StoreFrameCat } from "@/data/store";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";

const COINS = 12400;
const WALLET_USD = 142.5;

const CATS = ["Standart", "VIP ✦", "Yayıncı"];
const CAT_KEYS: StoreFrameCat[] = ["standart", "vip", "yayinci"];
const CAT_COLORS = [
  { active: C.gold, dim: `${C.gold}22` },
  { active: C.purple2, dim: `${C.purple}22` },
  { active: C.green, dim: `${C.green}22` },
];

function MagazaIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="mag_g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F5CE6E" />
          <Stop offset="1" stopColor="#C8922B" />
        </LinearGradient>
      </Defs>
      <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" fill="url(#mag_g)" opacity={0.95} />
      <Line x1="3" y1="6" x2="21" y2="6" stroke="#FDE68A" strokeWidth="1.4" strokeLinecap="round" />
      <Path d="M16 10a4 4 0 01-8 0" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Circle cx="9.5" cy="10" r="1" fill="#FDE68A" opacity={0.7} />
      <Circle cx="14.5" cy="10" r="1" fill="#FDE68A" opacity={0.7} />
    </Svg>
  );
}

export default function StoreScreen() {
  const router = useRouter();
  const isStreamer = useApp((s) => s.isStreamer);
  const [tab, setTab] = useState(0);
  const [payMode, setPayMode] = useState<"coins" | "wallet">("coins");
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (t: string) => {
    setMsg(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  };

  const frames = STORE_FRAMES.filter((f) => f.cat === CAT_KEYS[tab]);
  const cc = CAT_COLORS[tab];

  const buy = (f: (typeof STORE_FRAMES)[number]) => {
    if (owned.has(f.id)) return;
    const useWallet = payMode === "wallet" && f.usd != null;
    const cost = useWallet ? f.usd! : f.coins;
    const bal = useWallet ? WALLET_USD : COINS;
    if (cost > bal) { haptic.warning(); flash("Yetersiz bakiye!"); return; }
    haptic.success();
    setOwned((p) => new Set([...p, f.id]));
    flash(`"${f.name}" çerçeven aktif edildi ✓`);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <MagazaIcon size={24} />
          <Txt weight="displayBold" size={17} color="#fff">Mağaza</Txt>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <CoinBadge size={15} />
            <Txt weight="extrabold" size={12} color={C.gold}>{COINS.toLocaleString("tr-TR")}</Txt>
          </View>
          {isStreamer && (
            <Txt weight="extrabold" size={12} color="#6EE7B7" style={{ marginLeft: 8 }}>${WALLET_USD.toFixed(2)}</Txt>
          )}
        </View>

        <View style={styles.cats}>
          {CATS.map((c, i) => {
            const on = i === tab;
            return (
              <Pressable
                key={c}
                onPress={() => { haptic.select(); setTab(i); }}
                style={[styles.catBtn, { borderColor: on ? CAT_COLORS[i].active : C.line, backgroundColor: on ? CAT_COLORS[i].dim : C.card }]}
              >
                <Txt weight="extrabold" size={11} color={on ? CAT_COLORS[i].active : C.dim}>{c}</Txt>
              </Pressable>
            );
          })}
        </View>

        {tab === 2 && isStreamer && (
          <View style={styles.payRow}>
            {(["coins", "wallet"] as const).map((m) => {
              const on = payMode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => { haptic.select(); setPayMode(m); }}
                  style={[styles.payBtn, { borderColor: on ? C.gold : C.line, backgroundColor: on ? `${C.gold}14` : C.card }]}
                >
                  {m === "coins" ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <CoinBadge size={13} />
                      <Txt weight="bold" size={11} color={on ? C.gold2 : C.dim}>Coin</Txt>
                    </View>
                  ) : (
                    <Txt weight="bold" size={11} color={on ? C.gold2 : C.dim}>💳 Cüzdan</Txt>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {msg && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.toast}>
            <Txt weight="bold" size={11.5} color={C.green} align="center">{msg}</Txt>
          </Animated.View>
        )}

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {frames.map((f) => {
              const isOwned = owned.has(f.id);
              const useWallet = payMode === "wallet" && f.usd != null && tab === 2 && isStreamer;
              const canAfford = useWallet ? WALLET_USD >= (f.usd ?? 0) : COINS >= f.coins;
              const btnBg = isOwned
                ? `${C.green}22`
                : !canAfford
                  ? "rgba(255,255,255,.06)"
                  : tab === 1 ? `${C.purple}26` : tab === 2 ? `${C.green}22` : `${C.gold}1A`;
              const btnColor = isOwned
                ? C.green
                : !canAfford
                  ? C.dim2
                  : tab === 1 ? C.purple2 : tab === 2 ? C.green : C.gold2;
              return (
                <View key={f.id} style={[styles.card, { borderColor: isOwned ? cc.active : C.line }]}>
                  {isOwned && (
                    <View style={styles.ownedTick}>
                      <Txt weight="extrabold" size={11} color="#022C22">✓</Txt>
                    </View>
                  )}
                  <View style={{ width: 56, height: 56 }}>
                    <Portrait name="Sen" size={56} ring="transparent" glow={false} online={false} />
                    <FramePreview id={f.id} size={56} />
                  </View>
                  <View style={{ alignItems: "center", marginTop: 8 }}>
                    <Txt weight="extrabold" size={12} color={C.text}>{f.name}</Txt>
                    <Txt size={10} color={C.dim} align="center" style={{ marginTop: 2 }}>{f.desc}</Txt>
                  </View>
                  <Pressable
                    onPress={() => buy(f)}
                    disabled={isOwned}
                    style={[styles.buyBtn, { backgroundColor: btnBg }]}
                  >
                    {isOwned ? (
                      <Txt weight="extrabold" size={11.5} color={btnColor}>Aktif</Txt>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        {useWallet ? (
                          <Txt weight="extrabold" size={11.5} color={btnColor}>${f.usd}</Txt>
                        ) : (
                          <>
                            <CoinBadge size={13} />
                            <Txt weight="extrabold" size={11.5} color={btnColor}>{f.coins.toLocaleString("tr-TR")}</Txt>
                          </>
                        )}
                        {!canAfford && <Txt weight="extrabold" size={11.5} color={btnColor}> — Yetersiz</Txt>}
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  cats: { flexDirection: "row", gap: 6, paddingHorizontal: 16, marginTop: 10 },
  catBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 12, borderWidth: 1 },
  payRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, marginTop: 10 },
  payBtn: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 11, borderWidth: 1 },
  toast: { marginHorizontal: 20, marginTop: 10, backgroundColor: `${C.green}18`, borderWidth: 1, borderColor: `${C.green}44`, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", flexGrow: 1, backgroundColor: C.card, borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, alignItems: "center" },
  ownedTick: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: C.green, alignItems: "center", justifyContent: "center", zIndex: 2 },
  buyBtn: { width: "100%", paddingVertical: 9, borderRadius: 11, alignItems: "center", marginTop: 10 },
});
