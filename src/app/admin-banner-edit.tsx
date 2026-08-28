import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BANNER_ORAN } from "@/components/EventBanners";
import { Txt } from "@/components/Txt";
import {
  createBanner, getBanner, updateBanner,
  type BannerIcerik, type BannerMadde, type BannerSablon,
} from "@/data/remote/announceRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const SABLONLAR: { k: BannerSablon; ad: string; ic: IconName; rozet: string }[] = [
  { k: "duyuru", ad: "Duyuru", ic: "mega", rozet: "DUYURU" },
  { k: "bakim", ad: "Bakım", ic: "gear", rozet: "PLANLI BAKIM" },
  { k: "etkinlik", ad: "Etkinlik", ic: "gift", rozet: "ETKİNLİK" },
];

export default function AdminBannerEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const editId = id ? Number(id) : null;

  const [loading, setLoading] = useState(!!editId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2600); };

  const [sablon, setSablon] = useState<BannerSablon>("duyuru");
  const [baslik, setBaslik] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  // sayfa içeriği
  const [altBaslik, setAltBaslik] = useState("");
  const [rozet, setRozet] = useState("");
  const [giris, setGiris] = useState("");
  const [maddeler, setMaddeler] = useState<BannerMadde[]>([]);
  const [kapanis, setKapanis] = useState("");

  useEffect(() => {
    if (!editId || !isSupabaseConfigured) return;
    getBanner(editId).then((b) => {
      if (b) {
        setSablon(b.sablon); setBaslik(b.baslik); setAciklama(b.aciklama ?? ""); setFoto(b.foto ?? null);
        setAltBaslik(b.icerik.altBaslik ?? ""); setRozet(b.icerik.rozet ?? ""); setGiris(b.icerik.giris ?? "");
        setMaddeler(b.icerik.maddeler ?? []); setKapanis(b.icerik.kapanis ?? "");
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [editId]);

  const pickFoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Kırpma oranı banner çerçevesiyle birebir aynı olmalı, yoksa burada
      // seçilen alanın alt-üstü ana ekranda görünmez.
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [5, 2], quality: 0.85, base64: true });
      if (!res.canceled && res.assets[0]?.base64) setFoto(await uploadAvatar(res.assets[0].base64, res.assets[0].uri));
    } catch { flash("Foto yüklenemedi"); }
    finally { setBusy(false); }
  };

  const setMadde = (i: number, patch: Partial<BannerMadde>) =>
    setMaddeler((xs) => xs.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const addMadde = () => { haptic.light(); setMaddeler((xs) => [...xs, { baslik: "", aciklama: "" }]); };
  const removeMadde = (i: number) => { haptic.light(); setMaddeler((xs) => xs.filter((_, j) => j !== i)); };

  const save = async () => {
    if (!baslik.trim() || busy) return flash("Başlık gir");
    setBusy(true);
    const temiz: BannerMadde[] = maddeler
      .map((m) => ({ baslik: m.baslik.trim(), aciklama: (m.aciklama ?? "").trim() || undefined }))
      .filter((m) => m.baslik.length > 0);
    const icerik: BannerIcerik = {
      altBaslik: altBaslik.trim() || undefined,
      rozet: rozet.trim() || undefined,
      giris: giris.trim() || undefined,
      maddeler: temiz.length ? temiz : undefined,
      kapanis: kapanis.trim() || undefined,
    };
    try {
      if (editId) {
        await updateBanner(editId, baslik.trim(), aciklama.trim() || null, foto || null, 0, sablon, icerik);
      } else {
        await createBanner(baslik, aciklama.trim() || undefined, foto || undefined, 0, sablon, icerik);
      }
      haptic.light();
      router.back();
    } catch (e) { flash((e as Error)?.message || "Kaydedilemedi"); }
    finally { setBusy(false); }
  };

  const sablonRozet = SABLONLAR.find((s) => s.k === sablon)?.rozet ?? "DUYURU";

  return (
    <View style={styles.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <Txt weight="displayBold" size={16} color="#fff">{editId ? "Banner Düzenle" : "Yeni Banner"}</Txt>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.gold} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {!!note && <View style={styles.note}><Txt weight="bold" size={11.5} color={C.gold2} align="center">{note}</Txt></View>}

            {/* Şablon seçimi */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>ŞABLON</Txt>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {SABLONLAR.map((s) => {
                const on = sablon === s.k;
                return (
                  <Pressable key={s.k} onPress={() => setSablon(s.k)} style={[styles.sablonChip, on && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}55` }]}>
                    <Icon name={s.ic} size={16} color={on ? C.gold2 : C.dim} />
                    <Txt weight="bold" size={11} color={on ? C.gold2 : C.dim} style={{ marginTop: 5 }}>{s.ad}</Txt>
                  </Pressable>
                );
              })}
            </View>

            {/* Banner (oda listesi görünümü) */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>BANNER (LİSTE ÜSTÜ)</Txt>
            <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
              <TextInput value={baslik} onChangeText={setBaslik} placeholder="Başlık" placeholderTextColor={C.dim2} style={styles.input} />
              <TextInput value={aciklama} onChangeText={setAciklama} placeholder="Kısa açıklama (banner altı)" placeholderTextColor={C.dim2} style={styles.input} />
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Pressable disabled={busy} onPress={pickFoto} style={[styles.chip, { flexDirection: "row", gap: 5 }]}>
                  <Icon name="camera" size={12} color={C.gold2} /><Txt weight="bold" size={10.5} color={C.gold2}>{foto ? "Foto değiştir" : "Foto ekle (ops.)"}</Txt>
                </Pressable>
                {!!foto && <Pressable onPress={() => setFoto(null)}><Icon name="x" size={14} color="#FB7185" /></Pressable>}
              </View>
              <Txt size={9.5} color={C.dim2} lh={1.4}>Önerilen ölçü 1500×600 (5:2). Önizleme banner'da göreceğinin birebir aynısı.</Txt>
              {!!foto && <View style={styles.preview}><Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" /></View>}
            </View></View>

            {/* Açılır sayfa içeriği */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>AÇILIR SAYFA İÇERİĞİ</Txt>
            <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
              <TextInput value={altBaslik} onChangeText={setAltBaslik} placeholder="Alt başlık (hero)" placeholderTextColor={C.dim2} style={styles.input} />
              <TextInput value={rozet} onChangeText={setRozet} placeholder={`Rozet — boş bırakılırsa "${sablonRozet}"`} placeholderTextColor={C.dim2} style={styles.input} />
              <TextInput value={giris} onChangeText={setGiris} placeholder="Giriş paragrafı" placeholderTextColor={C.dim2} multiline style={[styles.input, { minHeight: 76, textAlignVertical: "top" }]} />
            </View></View>

            {/* Maddeler */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>MADDELER / BÖLÜMLER ({maddeler.length})</Txt>
            {maddeler.map((m, i) => (
              <View key={i} style={[styles.group, { marginBottom: 10 }]}><View style={{ padding: 12, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Txt weight="bold" size={10} color={C.dim2}>MADDE {i + 1}</Txt>
                  <Pressable onPress={() => removeMadde(i)} hitSlop={8} style={styles.delBtn}><Icon name="trash" size={12} color="#FB7185" /></Pressable>
                </View>
                <TextInput value={m.baslik} onChangeText={(t) => setMadde(i, { baslik: t })} placeholder="Madde başlığı" placeholderTextColor={C.dim2} style={styles.input} />
                <TextInput value={m.aciklama ?? ""} onChangeText={(t) => setMadde(i, { aciklama: t })} placeholder="Madde açıklaması (ops.)" placeholderTextColor={C.dim2} multiline style={[styles.input, { minHeight: 54, textAlignVertical: "top" }]} />
              </View></View>
            ))}
            <Pressable onPress={addMadde} style={styles.addBtn}>
              <Icon name="plus" size={14} sw={2.5} color={C.gold2} /><Txt weight="extrabold" size={12.5} color={C.gold2}>Madde Ekle</Txt>
            </Pressable>

            {/* Kapanış */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>KAPANIŞ</Txt>
            <View style={styles.group}><View style={{ padding: 12 }}>
              <TextInput value={kapanis} onChangeText={setKapanis} placeholder="Kapanış notu (ops.)" placeholderTextColor={C.dim2} multiline style={[styles.input, { minHeight: 64, textAlignVertical: "top" }]} />
            </View></View>

            <Pressable disabled={busy || !baslik.trim()} onPress={save} style={[styles.saveBtn, { opacity: !busy && baslik.trim() ? 1 : 0.45 }]}>
              {busy ? <ActivityIndicator color="#241A05" /> : <><Icon name="send" size={14} color="#241A05" /><Txt weight="extrabold" size={13} color="#241A05">{editId ? "Kaydet" : "Banner Oluştur"}</Txt></>}
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  chip: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", justifyContent: "center" },
  sablonChip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  note: { marginBottom: 4, marginTop: 8, paddingVertical: 9, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  // Ana ekrandaki banner çerçevesiyle aynı oran — önizleme yanıltmasın.
  preview: { width: "100%", aspectRatio: BANNER_ORAN, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.04)" },
  delBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.28)" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}44` },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 12, backgroundColor: C.gold2, marginTop: 20 },
});
