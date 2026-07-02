import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from "react-native";

import { AgencyEmblem } from "@/components/AgencyEmblem";
import { Badge, type BadgeType } from "@/components/Badge";
import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type InfoMode = "lang" | "badges" | "support";

const LANGS = ["Türkçe", "English", "العربية", "Español", "Русский"];
const FAQ = [
  { q: "Elmas nasıl yüklerim?", a: "Cüzdan veya hediye panelinden 'Elmas Yükle' ile App Store / Play üzerinden satın alabilirsin." },
  { q: "Yayıncı nasıl olurum?", a: "Profil ayarlarından yayıncı başvurusu yapabilir veya bir ajansa katılabilirsin." },
  { q: "Kazancımı nasıl çekerim?", a: "Yayıncıysan Cüzdan > Para Çek ekranından dolar kazancını istediğin hesaba gönderebilirsin." },
  { q: "Hesabım çalındı, ne yapmalıyım?", a: "Hesap & Güvenlik bölümünden şifreni değiştir ve destek ekibiyle iletişime geç." },
];
const BADGES: [BadgeType, string][] = [
  ["developer", "Developer"],
  ["vip", "VIP"],
  ["level", "Seviye"],
  ["streamer", "Yayıncı"],
  ["member", "Üye"],
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => { haptic.select(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setOpen((o) => !o); }}
      style={styles.faq}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Txt weight="bold" size={12.5} color={C.text} style={{ flex: 1 }}>{q}</Txt>
        <Icon name="chev" size={14} color={C.dim} />
      </View>
      {open && <Txt size={11.5} color={C.dim} lh={1.55} style={{ marginTop: 8 }}>{a}</Txt>}
    </Pressable>
  );
}

export function ProfileInfoSheet({
  visible,
  mode,
  lang,
  setLang,
  onClose,
}: {
  visible: boolean;
  mode: InfoMode;
  lang: string;
  setLang: (l: string) => void;
  onClose: () => void;
}) {
  const title = mode === "lang" ? "Dil Seçimi" : mode === "support" ? "Müşteri Hizmetleri & SSS" : "Rozetlerim";
  const userLevel = useApp((s) => s.userLevel);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Txt weight="displayBold" size={17} color="#fff" style={{ marginBottom: 14 }}>{title}</Txt>

      {mode === "lang" &&
        LANGS.map((l) => {
          const on = lang === l;
          return (
            <Pressable key={l} onPress={() => { haptic.select(); setLang(l); onClose(); }} style={[styles.langRow, { backgroundColor: on ? `${C.gold}12` : C.card, borderColor: on ? C.gold : C.line }]}>
              <Txt weight="bold" size={13} color={on ? C.gold2 : C.text} style={{ flex: 1 }}>{l}</Txt>
              {on && <Icon name="check" size={16} color={C.gold} sw={3} />}
            </Pressable>
          );
        })}

      {mode === "badges" && (
        <View style={styles.badgeGrid}>
          {BADGES.map(([t, lb]) => (
            <View key={t} style={styles.badgeCell}>
              <Badge type={t} size={40} lvl={t === "level" ? userLevel : undefined} />
              <Txt weight="bold" size={10.5} color={C.text}>{lb}</Txt>
            </View>
          ))}
          <View style={styles.badgeCell}>
            <AgencyEmblem s={40} />
            <Txt weight="bold" size={10.5} color={C.text}>Ajans</Txt>
          </View>
        </View>
      )}

      {mode === "support" && (
        <>
          <Pressable onPress={() => haptic.light()} style={{ borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
            <Gradient colors={["#60A5FA", "#2563EB"]} deg={90} style={styles.supportBtn}>
              <Icon name="chat" size={17} color="#fff" />
              <Txt weight="extrabold" size={13} color="#fff">Canlı Destek</Txt>
            </Gradient>
          </Pressable>
          <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.4, marginBottom: 10 }}>SIK SORULAN SORULAR</Txt>
          {FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  langRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center", paddingVertical: 6 },
  badgeCell: { width: "30%", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  supportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 14 },
  faq: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 14, marginBottom: 8 },
});
