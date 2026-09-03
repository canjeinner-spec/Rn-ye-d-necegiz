import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Scene, type SceneKind } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { updateRoomSettings } from "@/data/remote/roomsRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export const THEME_LABEL: Record<SceneKind, string> = {
  official: "Resmî", club: "Kulüp", lounge: "Lounge", night: "Gece", fire: "Ateş",
};
const THEMES: { key: SceneKind; label: string }[] = (Object.keys(THEME_LABEL) as SceneKind[]).map((key) => ({ key, label: THEME_LABEL[key] }));

export default function RoomManageEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const section = String(params.section || "avatar");
  const currentRoom = useApp((s) => s.currentRoom);
  const patchCurrentRoom = useApp((s) => s.patchCurrentRoom);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const dbId = currentRoom?.dbId;
  const isOwner = !!currentRoom?.owner;
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2400); };

  // Kapak: profil avatarıyla aynı deneyim — resme dokun, seç, anında kaydolur
  // (ayrı "Kaydet" düğmesi yok). Hata artık sessiz yutulmaz, flash gösterir.
  const pickCover = async () => {
    if (!dbId || busy) return;
    // Oda fotoğrafı her yerde kare/yuvarlak gösteriliyor: oda listesinde 62x62,
    // üst bardaki çipte 36x36, küçültülmüş oda banner'ında ve oda profilinde
    // yuvarlak avatar olarak. 16:9 kırpınca bu karelerde fotoğrafın yanları
    // kesiliyordu; kırpma da profil avatarı gibi 1:1 olmalı.
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
    if (res.canceled || !res.assets[0]?.base64) return;
    setBusy(true);
    try {
      const url = await uploadAvatar(res.assets[0].base64, res.assets[0].uri);
      patchCurrentRoom({ photo: url });
      await updateRoomSettings(dbId, { kapak_url: url });
      flash("Kapak güncellendi");
    } catch (e) {
      flash((e as Error)?.message || "Kapak kaydedilemedi, tekrar dene.");
    } finally {
      setBusy(false);
    }
  };
  const removeCover = async () => {
    if (!dbId || busy) return;
    haptic.light();
    patchCurrentRoom({ photo: undefined });
    setBusy(true);
    try {
      await updateRoomSettings(dbId, { kapak_url: null });
      flash("Kapak kaldırıldı");
    } catch (e) {
      flash((e as Error)?.message || "Kaldırılamadı, tekrar dene.");
    } finally {
      setBusy(false);
    }
  };
  const pickTheme = async (k: SceneKind) => {
    if (!dbId || busy) return;
    haptic.select();
    patchCurrentRoom({ scene: k });
    setBusy(true);
    try {
      await updateRoomSettings(dbId, { kategori: k });
      flash("Tema güncellendi");
    } catch (e) {
      flash((e as Error)?.message || "Tema kaydedilemedi, tekrar dene.");
    } finally {
      setBusy(false);
    }
  };

  if (!dbId || !isOwner) {
    return (
      <View style={styles.root}>
        <Gradient colors={["#16121F", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 }}>
            <Icon name="lock" size={26} color={C.dim2} />
            <Txt size={12.5} color={C.dim} align="center" lh={1.5}>Bu düzenleme yalnızca oda sahibine açıktır.</Txt>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <Txt weight="displayBold" size={16} color="#fff">{section === "avatar" ? "Oda Avatarı" : "Oda Teması"}</Txt>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {!!note && <View style={styles.note}><Txt weight="bold" size={11.5} color={C.gold2} align="center">{note}</Txt></View>}

          {section === "avatar" ? (
            <View style={{ alignItems: "center" }}>
              <Pressable onPress={pickCover} disabled={busy} style={styles.coverWrap}>
                <View style={styles.coverPreview}>
                  {currentRoom?.photo ? <Image source={{ uri: currentRoom.photo }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} /> : <Scene kind={currentRoom?.scene ?? "club"} />}
                </View>
                <View style={styles.camBadge}>
                  <Icon name="camera" size={14} sw={2} color="#241A05" />
                </View>
              </Pressable>
              <Txt weight="semibold" size={10.5} color={C.dim2} style={{ marginTop: 12 }}>{busy ? "Yükleniyor…" : "Değiştirmek için dokun"}</Txt>
              {!!currentRoom?.photo && (
                <Pressable disabled={busy} onPress={removeCover} style={styles.removeBtn}>
                  <Icon name="trash" size={13} color="#FB7185" /><Txt weight="bold" size={12} color="#FB7185">Kaldır</Txt>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Txt size={11.5} color={C.dim} lh={1.5}>Oda arka planını seç, dokununca anında kaydedilir.</Txt>
              <View style={{ gap: 10 }}>
                {THEMES.map((t) => {
                  const on = currentRoom?.scene === t.key;
                  return (
                    <Pressable key={t.key} disabled={busy} onPress={() => pickTheme(t.key)} style={[styles.themeRow, on && { borderColor: C.gold, borderWidth: 2 }]}>
                      <View style={styles.themePreview}><Scene kind={t.key} /></View>
                      <Txt weight={on ? "extrabold" : "semibold"} size={13.5} color={on ? C.gold2 : C.text} style={{ flex: 1 }}>{t.label}</Txt>
                      {on && <View style={styles.themeCheck}><Icon name="check" size={11} sw={2.5} color="#3A2A05" /></View>}
                    </Pressable>
                  );
                })}
              </View>
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
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },
  note: { marginBottom: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  coverWrap: { alignSelf: "center" },
  // Profil avatarı gibi: kare kırpma, yuvarlak önizleme.
  coverPreview: { width: 168, height: 168, borderRadius: 84, overflow: "hidden", borderWidth: 2, borderColor: C.gold + "55", backgroundColor: C.kart },
  camBadge: { position: "absolute", right: 4, bottom: 6, width: 38, height: 38, borderRadius: 19, backgroundColor: C.gold2, borderWidth: 3, borderColor: "#08080C", alignItems: "center", justifyContent: "center" },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.3)" },
  themeRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  themePreview: { width: 52, height: 52, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.line },
  themeCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
});
