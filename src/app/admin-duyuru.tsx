import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import {
  deleteBanner, listBanners, sendAnnouncement,
  type AnnounceKanal, type Banner, type BannerSablon,
} from "@/data/remote/announceRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const SABLON_AD: Record<BannerSablon, string> = { duyuru: "DUYURU", bakim: "BAKIM", etkinlik: "ETKİNLİK" };
const SABLON_IC = { duyuru: "mega", bakim: "gear", etkinlik: "gift" } as const;

async function pickPhoto(): Promise<{ url: string } | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.85, base64: true });
  if (res.canceled || !res.assets[0]?.base64) return null;
  const url = await uploadAvatar(res.assets[0].base64, res.assets[0].uri);
  return { url };
}

export default function AdminDuyuru() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2600); };

  // duyuru composer
  const [kanal, setKanal] = useState<AnnounceKanal>("aron");
  const [dBaslik, setDBaslik] = useState("");
  const [dIcerik, setDIcerik] = useState("");
  const [dFoto, setDFoto] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState(true);

  const reload = useCallback(() => {
    if (!isSupabaseConfigured) return;
    listBanners().then(setBanners).catch((e) => console.warn("[duyuru] banner:", e?.message || e));
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const removeBanner = async (id: number) => {
    haptic.light();
    setBanners((xs) => xs.filter((x) => x.id !== id)); // optimistik
    try { await deleteBanner(id); } catch { reload(); }
  };
  const pickDuyuruPhoto = async () => {
    if (busy) return;
    setBusy(true);
    try { const r = await pickPhoto(); if (r) setDFoto(r.url); } catch { flash("Foto yüklenemedi"); }
    finally { setBusy(false); }
  };
  const sendDuyuru = async () => {
    if (!dBaslik.trim() || !dIcerik.trim() || busy) return flash("Başlık ve metin gerekli");
    setBusy(true);
    try {
      await sendAnnouncement(kanal, dBaslik, dIcerik, dFoto || undefined, bildirim);
      setDBaslik(""); setDIcerik(""); setDFoto(null);
      flash(bildirim ? "Duyuru gönderildi (bildirimli)" : "Duyuru gönderildi");
    } catch (e) { flash((e as Error)?.message || "Gönderilemedi"); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="mega" size={17} color={C.gold} />
            <Txt weight="displayBold" size={16} color="#fff">Duyuru & Banner</Txt>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!!note && <View style={styles.note}><Txt weight="bold" size={11.5} color={C.gold2} align="center">{note}</Txt></View>}

          {/* ===== HERKESE DUYURU ===== */}
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>HERKESE DUYURU / SİSTEM MESAJI</Txt>
          <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(["aron", "sistem"] as const).map((k) => (
                <Pressable key={k} onPress={() => setKanal(k)} style={[styles.chip, kanal === k && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                  <Txt weight="bold" size={10.5} color={kanal === k ? C.gold2 : C.dim}>{k === "aron" ? "Aron (Resmî)" : "Sistem"}</Txt>
                </Pressable>
              ))}
            </View>
            <TextInput value={dBaslik} onChangeText={setDBaslik} placeholder="Başlık" placeholderTextColor={C.dim2} style={styles.input} />
            <TextInput value={dIcerik} onChangeText={setDIcerik} placeholder="Mesaj metni" placeholderTextColor={C.dim2} multiline style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]} />
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Pressable disabled={busy} onPress={pickDuyuruPhoto} style={[styles.chip, { flexDirection: "row", gap: 5 }]}>
                <Icon name="camera" size={12} color={C.gold2} /><Txt weight="bold" size={10.5} color={C.gold2}>{dFoto ? "Foto değiştir" : "Foto ekle (ops.)"}</Txt>
              </Pressable>
              {!!dFoto && <Pressable onPress={() => setDFoto(null)}><Icon name="x" size={14} color="#FB7185" /></Pressable>}
            </View>
            {!!dFoto && <View style={styles.preview}><Image source={{ uri: dFoto }} style={StyleSheet.absoluteFill} contentFit="cover" /></View>}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={12} color={C.text}>Bildirim olarak da gönder</Txt>
                <Txt size={10} color={C.dim} style={{ marginTop: 1 }}>Herkesin bildirim çanına düşer</Txt>
              </View>
              <Switch value={bildirim} onValueChange={setBildirim} trackColor={{ true: C.gold, false: "rgba(255,255,255,.15)" }} thumbColor="#fff" />
            </View>
            <Pressable disabled={busy || !dBaslik.trim() || !dIcerik.trim()} onPress={sendDuyuru} style={[styles.sendBtn, { opacity: !busy && dBaslik.trim() && dIcerik.trim() ? 1 : 0.45 }]}>
              {busy ? <ActivityIndicator color="#241A05" /> : <><Icon name="send" size={14} color="#241A05" /><Txt weight="extrabold" size={13} color="#241A05">Herkese Gönder</Txt></>}
            </Pressable>
            <Txt size={9.5} color={C.dim2} lh={1.4}>Gönderim; DM'deki {kanal === "aron" ? "Aron (resmî)" : "Sistem"} hesabında{bildirim ? " ve bildirim çanında" : ""} görünür.</Txt>
          </View></View>

          {/* ===== BANNER YÖNETİMİ ===== */}
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>BANNER'LAR (ODA LİSTESİ ÜSTÜ)</Txt>
          <Pressable onPress={() => router.navigate("/admin-banner-edit")} style={styles.addBtn}>
            <Icon name="plus" size={14} sw={2.5} color={C.gold2} /><Txt weight="extrabold" size={12.5} color={C.gold2}>Yeni Banner (şablon seç)</Txt>
          </Pressable>

          <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>MEVCUT BANNER'LAR ({banners.length})</Txt>
          {banners.length === 0 ? (
            <View style={styles.empty}><Icon name="mega" size={16} color={C.dim2} /><Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Henüz banner yok. Yukarıdan ekle.</Txt></View>
          ) : (
            <View style={styles.group}>
              {banners.map((b, i) => (
                <View key={b.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <Pressable onPress={() => router.navigate(`/admin-banner-edit?id=${b.id}`)} style={styles.bannerRow}>
                    <View style={styles.bThumb}>
                      {b.foto ? <Image source={{ uri: b.foto }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name={SABLON_IC[b.sablon]} size={16} color={C.dim2} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={styles.sablonBadge}><Txt weight="bold" size={8} color={C.gold2} style={{ letterSpacing: 0.5 }}>{SABLON_AD[b.sablon]}</Txt></View>
                      </View>
                      <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1} style={{ marginTop: 3 }}>{b.baslik}</Txt>
                      {!!b.aciklama && <Txt size={10.5} color={C.dim} numberOfLines={1} lh={1.3} style={{ marginTop: 1 }}>{b.aciklama}</Txt>}
                    </View>
                    <Pressable onPress={() => removeBanner(b.id)} hitSlop={8} style={styles.delBtn}>
                      <Icon name="trash" size={13} color="#FB7185" />
                    </Pressable>
                    <Icon name="chev" size={15} color={C.dim2} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 62 },
  chip: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", justifyContent: "center" },
  note: { marginBottom: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  preview: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.04)" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 12, backgroundColor: C.gold2 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}44` },
  empty: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  bThumb: { width: 46, height: 46, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(255,255,255,.04)", alignItems: "center", justifyContent: "center" },
  sablonBadge: { alignSelf: "flex-start", paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 5, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  delBtn: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.28)" },
});
