import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { getMyBalance, listMyLedger, type LedgerRow as LedgerData } from "@/data/remote/walletRepo";
import { LEDGER_ICON, WALLET_LEDGER, type LedgerBirim, type LedgerTx } from "@/data/wallet";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function ledgerZaman(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function RealLedgerRow({ tx }: { tx: LedgerData }) {
  const pos = tx.miktar > 0;
  return (
    <View style={styles.ledgerRow}>
      <View style={[styles.ledgerIcon, { backgroundColor: (tx.varlik === "elmas" ? "#22D3EE" : "#FBBF24") + "1A", borderColor: (tx.varlik === "elmas" ? "#22D3EE" : "#FBBF24") + "33" }]}>
        {tx.varlik === "elmas" ? <DiamondBadge size={18} /> : <CoinBadge size={18} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="bold" size={12.5} color={C.text} numberOfLines={1}>{tx.sebep || (pos ? "Yükleme" : "Harcama")}</Txt>
        <Txt weight="semibold" size={10} color={C.dim} style={{ marginTop: 2 }}>{ledgerZaman(tx.at)}</Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Txt weight="extrabold" size={13} color={pos ? "#34D399" : "#FB7185"}>{pos ? "+" : "−"}</Txt>
        {tx.varlik === "elmas" ? <DiamondBadge size={13} /> : <CoinBadge size={13} />}
        <Txt weight="extrabold" size={13} color={pos ? "#34D399" : "#FB7185"}>{Math.abs(tx.miktar).toLocaleString("tr-TR")}</Txt>
      </View>
    </View>
  );
}

function Unit({ birim, size = 13 }: { birim: LedgerBirim; size?: number }) {
  if (birim === "altin") return <CoinBadge size={size} />;
  if (birim === "diamond") return <DiamondBadge size={size} />;
  return <Txt weight="extrabold" size={size * 0.95}>$</Txt>;
}

function LedgerRow({ tx }: { tx: LedgerTx }) {
  const ic = LEDGER_ICON[tx.tip];
  const pos = tx.yon === "in";
  return (
    <View style={styles.ledgerRow}>
      <View style={[styles.ledgerIcon, { backgroundColor: ic.c + "1A", borderColor: ic.c + "33" }]}>
        <Txt size={18}>{ic.e}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="bold" size={12.5} color={C.text} numberOfLines={1}>{tx.baslik}</Txt>
        <Txt weight="semibold" size={10} color={C.dim} style={{ marginTop: 2 }}>{tx.alt} · {tx.date}</Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Txt weight="extrabold" size={13} color={pos ? "#34D399" : "#FB7185"}>{pos ? "+" : "−"}</Txt>
        <Unit birim={tx.birim} size={13} />
        <Txt weight="extrabold" size={13} color={pos ? "#34D399" : "#FB7185"}>{Math.abs(tx.tutar).toLocaleString("tr-TR")}</Txt>
      </View>
    </View>
  );
}

function StatCard({ label, sub, accent, children }: { label: string; sub: string; accent: string; children: React.ReactNode }) {
  return (
    <View style={[styles.statCard, { backgroundColor: accent + "14", borderColor: accent + "33" }]}>
      <Txt weight="bold" size={10} color={C.dim}>{label}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>{children}</View>
      <Txt weight="semibold" size={9.5} color={C.dim2} style={{ marginTop: 3 }}>{sub}</Txt>
    </View>
  );
}

export default function WalletScreen() {
  const router = useRouter();
  const isStreamer = useApp((s) => s.isStreamer);
  const [tab, setTab] = useState(0);
  const [stub, setStub] = useState<string | null>(null);

  // Gerçek bakiye + işlem defteri (027_cuzdan); ekrana her gelişte tazele
  const [bal, setBal] = useState<{ elmas: number; altin: number }>({ elmas: 0, altin: 0 });
  const [ledger, setLedger] = useState<LedgerData[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      let alive = true;
      getMyBalance().then((b) => { if (alive) setBal(b); }).catch(() => {});
      listMyLedger().then((l) => { if (alive) setLedger(l); }).catch(() => {});
      return () => { alive = false; };
    }, []),
  );
  const altin = bal.altin;
  const diamonds = bal.elmas;
  const withdrawable = 142.5; // yayıncı kazancı — IAP/çekim alanı (Faz 6), mock kalır

  return (
    <View style={styles.root}>
      <Gradient colors={["#1A1430", "#08080C"]} deg={180} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Cüzdan</Txt>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setStub("Cüzdan Kuralları")} style={styles.rulesBtn}>
            <Txt weight="bold" size={11.5} color={C.dim}>Kurallar</Txt>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {["Genel", "İşlem Geçmişi"].map((t, i) => (
            <Pressable key={t} onPress={() => setTab(i)} style={{ flex: 1, borderRadius: 11, overflow: "hidden" }}>
              {i === tab ? (
                <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={styles.tabInner}>
                  <Txt weight="extrabold" size={12.5} color="#fff">{t}</Txt>
                </Gradient>
              ) : (
                <View style={styles.tabInner}>
                  <Txt weight="extrabold" size={12.5} color={C.dim}>{t}</Txt>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              {isStreamer ? (
                <Gradient colors={["rgba(16,185,129,.28)", "rgba(217,119,6,.16)"]} deg={150} style={styles.hero}>
                  <Txt weight="bold" size={11.5} color="rgba(255,255,255,.7)">Çekilebilir Kazanç</Txt>
                  <Txt weight="displayBold" size={34} color="#fff" style={{ marginTop: 6 }}>${withdrawable.toFixed(2)}</Txt>
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <CoinBadge size={15} />
                      <Txt weight="extrabold" size={12.5} color="#FEF3C7">{altin.toLocaleString("tr-TR")}</Txt>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <DiamondBadge size={15} />
                      <Txt weight="extrabold" size={12.5} color="#A5F3FC">{diamonds.toLocaleString("tr-TR")}</Txt>
                    </View>
                  </View>
                </Gradient>
              ) : (
                <Gradient colors={["rgba(34,211,238,.22)", "rgba(124,58,237,.2)"]} deg={150} style={styles.hero}>
                  <Txt weight="bold" size={11.5} color="rgba(255,255,255,.7)">Elmas Bakiyem</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 6 }}>
                    <DiamondBadge size={30} />
                    <Txt weight="displayBold" size={36} color="#fff">{diamonds.toLocaleString("tr-TR")}</Txt>
                  </View>
                  <Txt weight="semibold" size={10.5} color="rgba(255,255,255,.55)" style={{ marginTop: 8 }}>Hediye göndermek ve mağaza için kullanılır</Txt>
                </Gradient>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                {isStreamer ? (
                  <>
                    <StatCard label="Coin Kazancı" sub="Hediyelerden kazanıldı" accent="#FBBF24">
                      <CoinBadge size={17} />
                      <Txt weight="displayBold" size={19} color="#fff">{altin.toLocaleString("tr-TR")}</Txt>
                    </StatCard>
                    <StatCard label="Bu Ay" sub="Tahmini ödeme" accent="#34D399">
                      <Txt weight="displayBold" size={19} color="#fff">$92.40</Txt>
                    </StatCard>
                  </>
                ) : (
                  <>
                    <StatCard label="Elmas" sub="Harcanabilir" accent="#22D3EE">
                      <DiamondBadge size={17} />
                      <Txt weight="displayBold" size={19} color="#fff">{diamonds.toLocaleString("tr-TR")}</Txt>
                    </StatCard>
                    <StatCard label="Altın" sub="Oda & etkinlik" accent="#FBBF24">
                      <CoinBadge size={17} />
                      <Txt weight="displayBold" size={19} color="#fff">{altin.toLocaleString("tr-TR")}</Txt>
                    </StatCard>
                  </>
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <Pressable onPress={() => { haptic.light(); router.navigate("/diamond-load"); }} style={[styles.quick, { borderColor: "#22D3EE40", backgroundColor: "rgba(14,42,46,0.6)" }]}>
                  <DiamondBadge size={26} />
                  <Txt weight="extrabold" size={11} color="#5EEAD4">Elmas Yükle</Txt>
                </Pressable>
                {isStreamer && (
                  <Pressable onPress={() => { haptic.light(); router.navigate("/withdraw"); }} style={[styles.quick, { borderColor: "#34D39940", backgroundColor: "rgba(12,42,30,0.6)" }]}>
                    <Txt size={24}>🏦</Txt>
                    <Txt weight="extrabold" size={11} color="#6EE7B7">Para Çek</Txt>
                  </Pressable>
                )}
                <Pressable onPress={() => setStub("Faturalar")} style={[styles.quick, { borderColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(255,255,255,.04)" }]}>
                  <Txt size={24}>🧾</Txt>
                  <Txt weight="extrabold" size={11} color={C.dim}>Faturalar</Txt>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 22, marginBottom: 10 }}>
                <Txt weight="displayBold" size={13.5} color="#fff">Son İşlemler</Txt>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => setTab(1)}>
                  <Txt weight="bold" size={11.5} color={C.purple2}>Tümü ›</Txt>
                </Pressable>
              </View>
              {ledger.length > 0
                ? ledger.slice(0, 3).map((tx) => <RealLedgerRow key={tx.id} tx={tx} />)
                : WALLET_LEDGER.slice(0, 3).map((tx) => <LedgerRow key={tx.id} tx={tx} />)}
            </>
          ) : (
            <>
              {ledger.length > 0 ? (
                ledger.map((tx) => <RealLedgerRow key={tx.id} tx={tx} />)
              ) : (
                <>
                  {WALLET_LEDGER.map((tx) => <LedgerRow key={tx.id} tx={tx} />)}
                  <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 16 }}>Henüz gerçek işlem yok — örnek gösteriliyor.</Txt>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Sheet visible={!!stub} onClose={() => setStub(null)} contentStyle={{ alignItems: "center" }}>
        <Txt size={28}>🧾</Txt>
        <Txt weight="bold" size={13} color={C.dim} style={{ marginTop: 12, marginBottom: 4 }}>{stub} — Aşama 5</Txt>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  rulesBtn: { height: 30, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 6, backgroundColor: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4 },
  tabInner: { paddingVertical: 9, alignItems: "center", borderRadius: 11 },
  hero: { borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", overflow: "hidden" },
  statCard: { flex: 1, minWidth: 0, borderRadius: 18, padding: 14, borderWidth: 1 },
  quick: { flex: 1, alignItems: "center", gap: 7, paddingVertical: 15, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1 },
  ledgerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  ledgerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
