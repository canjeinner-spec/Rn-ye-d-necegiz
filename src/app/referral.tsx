import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { REF_FRIENDS, REF_TIERS } from "@/data/referral";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const CODE = "ARON-4407";

export default function ReferralScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invited = REF_FRIENDS.length;
  const earned = REF_FRIENDS.reduce((s, f) => s + f.reward, 0);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const nextTier = REF_TIERS.find((t) => t.n > invited) || REF_TIERS[REF_TIERS.length - 1];
  const prevN = [...REF_TIERS].reverse().find((t) => t.n <= invited)?.n || 0;
  const pct = Math.min(100, Math.round(((invited - prevN) / (nextTier.n - prevN)) * 100));

  const flash = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setToast(""); setCopied(false); }, 1800);
  };
  const copy = () => { haptic.success(); setCopied(true); flash("Davet kodu kopyalandı!"); };
  const share = () => { haptic.light(); flash("Paylaşım menüsü açılıyor…"); };

  return (
    <View style={styles.root}>
      <Gradient colors={["#0A2A1E", "#08080C"]} deg={170} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Arkadaşını Davet Et</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 18 }}>
            <Gradient colors={["#34D399", "#059669"]} deg={135} style={styles.heroIcon}>
              <Icon name="userAdd" size={28} color="#fff" />
            </Gradient>
            <Txt weight="displayBold" size={18} color="#fff">Davet et, birlikte kazanın</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 6, maxWidth: 280 }}>
              <Txt size={12} color={C.dim} lh={1.55} align="center">Her arkadaş için sana </Txt>
              <Txt weight="bold" size={12} color="#6EE7B7">50</Txt>
              <Txt size={12} color={C.dim}>, arkadaşına </Txt>
              <Txt weight="bold" size={12} color="#6EE7B7">100</Txt>
              <Txt size={12} color={C.dim}> elmas.</Txt>
            </View>
          </View>

          <View style={styles.codeRow}>
            <Txt weight="semibold" size={12.5} color={C.dim}>Davet kodun</Txt>
            <Txt weight="displayBold" size={18} color="#6EE7B7" style={{ flex: 1, textAlign: "center", letterSpacing: 1.5 }}>{CODE}</Txt>
            <Pressable onPress={copy} style={[styles.copyBtn, { borderColor: copied ? "rgba(52,211,153,.5)" : "rgba(255,255,255,.14)", backgroundColor: copied ? "rgba(52,211,153,.14)" : "rgba(255,255,255,.05)" }]}>
              <Icon name={copied ? "check" : "copy"} size={14} color={copied ? "#6EE7B7" : C.text} sw={copied ? 3 : 2} />
              <Txt weight="extrabold" size={12} color={copied ? "#6EE7B7" : C.text}>{copied ? "Kopyalandı" : "Kopyala"}</Txt>
            </Pressable>
          </View>

          <Pressable onPress={share} style={{ marginTop: 16, borderRadius: 14, overflow: "hidden" }}>
            <Gradient colors={["#34D399", "#059669"]} deg={135} style={styles.shareBtn}>
              <Icon name="share" size={17} color="#04231A" />
              <Txt weight="extrabold" size={13.5} color="#04231A">Davet Bağlantısını Paylaş</Txt>
            </Gradient>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24 }}>
            <View>
              <Txt weight="semibold" size={11} color={C.dim}>Davet Ettiğin</Txt>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 }}>
                <Txt weight="displayBold" size={23} color="#fff">{invited}</Txt>
                <Txt weight="semibold" size={13} color={C.dim}>kişi</Txt>
              </View>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ alignItems: "flex-end" }}>
              <Txt weight="semibold" size={11} color={C.dim}>Kazandığın</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                <DiamondBadge size={16} />
                <Txt weight="displayBold" size={19} color="#6EE7B7">{earned}</Txt>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14, marginBottom: 6 }}>
            <View style={{ flexDirection: "row" }}>
              <Txt weight="semibold" size={10.5} color={C.dim}>Sonraki ödül: </Txt>
              <Txt weight="bold" size={10.5} color="#6EE7B7">{nextTier.n} arkadaş</Txt>
            </View>
            <Txt weight="semibold" size={10.5} color={C.dim}>{invited}/{nextTier.n}</Txt>
          </View>
          <View style={styles.barBg}>
            <Gradient colors={["#34D399", "#059669"]} deg={90} style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 }}>
            <DiamondBadge size={12} />
            <Txt weight="semibold" size={11} color={C.dim}>{nextTier.reward} elmas için {nextTier.n - invited} davet kaldı</Txt>
          </View>

          <Txt weight="extrabold" size={13} color={C.text} style={{ marginTop: 22, marginBottom: 10 }}>Kademe Ödülleri</Txt>
          <View style={{ flexDirection: "row", gap: 9 }}>
            {REF_TIERS.map((t) => {
              const reached = invited >= t.n;
              return (
                <View key={t.n} style={[styles.tier, { backgroundColor: reached ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.04)", borderColor: reached ? "rgba(52,211,153,.4)" : "rgba(255,255,255,.08)" }]}>
                  <View style={[styles.tierBadge, { backgroundColor: reached ? "transparent" : "rgba(255,255,255,.06)" }]}>
                    {reached && <Gradient colors={["#34D399", "#059669"]} deg={135} style={StyleSheet.absoluteFill} />}
                    {reached ? (
                      <Icon name="check" size={16} color="#fff" sw={3} />
                    ) : (
                      <Txt weight="extrabold" size={11} color={C.dim}>{t.n}</Txt>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <DiamondBadge size={11} />
                    <Txt weight="extrabold" size={11} color={reached ? "#6EE7B7" : C.text}>{t.reward >= 1000 ? t.reward / 1000 + "K" : t.reward}</Txt>
                  </View>
                  <Txt weight="semibold" size={8.5} color={C.dim2} align="center" style={{ marginTop: 3 }}>{t.label}</Txt>
                </View>
              );
            })}
          </View>

          <Txt weight="extrabold" size={13} color={C.text} style={{ marginTop: 22, marginBottom: 10 }}>Davet Ettiklerin ({invited})</Txt>
          {REF_FRIENDS.map((f, i) => (
            <View key={f.name + i} style={styles.friendRow}>
              <Portrait name={f.name} size={44} online={i === 0} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Txt weight="extrabold" size={13.5} color={C.text}>{f.name}</Txt>
                  <Txt weight="extrabold" size={10.5} color="#5EEAD4">LV.{f.lv}</Txt>
                </View>
                <Txt size={10.5} color={C.dim2} style={{ marginTop: 3 }}>{f.when} katıldı</Txt>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Txt weight="extrabold" size={12} color="#6EE7B7">+</Txt>
                <DiamondBadge size={13} />
                <Txt weight="extrabold" size={12} color="#6EE7B7">{f.reward}</Txt>
              </View>
            </View>
          ))}
          <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 16 }}>Ödüller arkadaşın ilk girişini yapınca tanımlanır</Txt>
        </ScrollView>
      </SafeAreaView>

      {!!toast && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.toast, { bottom: 30 + insets.bottom }]}>
          <Txt weight="bold" size={12} color="#fff">{toast}</Txt>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  heroIcon: { width: 56, height: 56, borderRadius: 18, marginBottom: 12, alignItems: "center", justifyContent: "center" },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  barBg: { height: 7, borderRadius: 7, backgroundColor: "rgba(255,255,255,.08)", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 7 },
  tier: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center", borderWidth: 1 },
  tierBadge: { width: 32, height: 32, borderRadius: 16, marginBottom: 7, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: "rgba(52,211,153,.5)", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999 },
});
