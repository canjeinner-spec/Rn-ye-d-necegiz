import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import { sendAnnouncement, type AnnounceKanal } from "@/data/remote/announceRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { adminStyles as s } from "@/lib/adminMsgStyles";

export default function AdminBroadcast() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2600); };

  const [kanal, setKanal] = useState<AnnounceKanal>("aron");
  const [baslik, setBaslik] = useState("");
  const [icerik, setIcerik] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState(true);

  const pickFoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.85, base64: true });
      if (!res.canceled && res.assets[0]?.base64) setFoto(await uploadAvatar(res.assets[0].base64, res.assets[0].uri));
    } catch { flash("Foto yüklenemedi"); }
    finally { setBusy(false); }
  };
  const send = async () => {
    if (!baslik.trim() || !icerik.trim() || busy) return flash("Başlık ve metin gerekli");
    setBusy(true);
    try {
      await sendAnnouncement(kanal, baslik, icerik, foto || undefined, bildirim);
      setBaslik(""); setIcerik(""); setFoto(null);
      flash(bildirim ? "Duyuru gönderildi (bildirimli)" : "Duyuru gönderildi");
    } catch (e) { flash((e as Error)?.message || "Gönderilemedi"); }
    finally { setBusy(false); }
  };

  return (
    <View style={s.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="mega" size={17} color={C.gold} /><Txt weight="displayBold" size={16} color="#fff">Herkese Duyuru</Txt>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!!note && <View style={s.note}><Txt weight="bold" size={11.5} color={C.gold2} align="center">{note}</Txt></View>}

          <Txt weight="bold" size={10.5} color={C.dim} style={s.lbl}>KANAL</Txt>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["aron", "sistem"] as const).map((k) => (
              <Pressable key={k} onPress={() => setKanal(k)} style={[s.chip, kanal === k && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                <Txt weight="bold" size={10.5} color={kanal === k ? C.gold2 : C.dim}>{k === "aron" ? "Aron (Resmî)" : "Sistem"}</Txt>
              </Pressable>
            ))}
          </View>

          <Txt weight="bold" size={10.5} color={C.dim} style={s.lbl}>MESAJ</Txt>
          <View style={s.group}><View style={{ padding: 12, gap: 10 }}>
            <TextInput value={baslik} onChangeText={setBaslik} placeholder="Başlık" placeholderTextColor={C.dim2} style={s.input} />
            <TextInput value={icerik} onChangeText={setIcerik} placeholder="Mesaj metni" placeholderTextColor={C.dim2} multiline style={[s.input, { minHeight: 90, textAlignVertical: "top" }]} />
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Pressable disabled={busy} onPress={pickFoto} style={[s.chip, { flexDirection: "row", gap: 5 }]}>
                <Icon name="camera" size={12} color={C.gold2} /><Txt weight="bold" size={10.5} color={C.gold2}>{foto ? "Foto değiştir" : "Foto ekle (ops.)"}</Txt>
              </Pressable>
              {!!foto && <Pressable onPress={() => setFoto(null)}><Icon name="x" size={14} color="#FB7185" /></Pressable>}
            </View>
            {!!foto && <View style={s.preview}><Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} /></View>}
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={12} color={C.text}>Bildirim olarak da gönder</Txt>
                <Txt size={10} color={C.dim} style={{ marginTop: 1 }}>Herkesin bildirim çanına düşer</Txt>
              </View>
              <Switch value={bildirim} onValueChange={setBildirim} trackColor={{ true: C.gold, false: "rgba(255,255,255,.15)" }} thumbColor="#fff" />
            </View>
          </View></View>

          <Pressable disabled={busy || !baslik.trim() || !icerik.trim()} onPress={send} style={[s.sendBtn, { opacity: !busy && baslik.trim() && icerik.trim() ? 1 : 0.45 }]}>
            {busy ? <ActivityIndicator color="#241A05" /> : <><Icon name="send" size={14} color="#241A05" /><Txt weight="extrabold" size={13} color="#241A05">Herkese Gönder</Txt></>}
          </Pressable>
          <Txt size={9.5} color={C.dim2} lh={1.4} style={{ marginTop: 10 }}>DM'deki {kanal === "aron" ? "Aron (resmî)" : "Sistem"} hesabında{bildirim ? " ve bildirim çanında" : ""} görünür.</Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
