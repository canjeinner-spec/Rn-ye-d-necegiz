import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { KeyboardAware } from "@/components/KeyboardAware";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Stage = "bot" | "connecting" | "agent";
type Action = { label: string; type: "route" | "agent"; route?: string };
type SMsg = { id: number; role: "bot" | "user" | "system"; text: string; actions?: Action[]; tone?: "connect" | "info" };

const AGENT = "Aylin K.";

type Topic = { label: string; type: "solve" | "agent"; route?: string; routeLabel?: string; reply: string };
const TOPICS: Topic[] = [
  { label: "Hesap & şifre", type: "solve", route: "/security", routeLabel: "Hesap & Güvenlik'e git", reply: "Şifre, telefon ve hesap güvenliği işlemlerini Hesap & Güvenlik ekranından kendin yapabilirsin." },
  { label: "Elmas / ödeme", type: "solve", route: "/wallet", routeLabel: "Cüzdan'a git", reply: "Bakiyeni, işlem geçmişini ve elmas yüklemeyi Cüzdan ekranından görebilirsin." },
  { label: "Mağaza & hediye", type: "solve", route: "/store", routeLabel: "Mağaza'ya git", reply: "Çerçeve ve eşyaları Mağaza'dan inceleyip satın alabilirsin." },
  { label: "Görev / seviye", type: "solve", route: "/tasks", routeLabel: "Görevler'e git", reply: "Günlük giriş ödülleri ve görevleri Görevler ekranından takip edebilirsin." },
  { label: "Ödeme yaptım gelmedi", type: "agent", reply: "Bu işlemi bir temsilcimizin incelemesi gerekiyor." },
  { label: "Hesabım çalındı", type: "agent", reply: "Güvenliğin için bunu hemen bir temsilciye aktaralım." },
  { label: "Başka bir sorun", type: "agent", reply: "Tabii, seni bir temsilciye aktarabilirim." },
];

let UID = 1;

export default function SupportScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [stage, setStage] = useState<Stage>("bot");
  const [picked, setPicked] = useState(false);
  const [input, setInput] = useState("");
  const [complained, setComplained] = useState(false);
  const [msgs, setMsgs] = useState<SMsg[]>([
    { id: UID++, role: "bot", text: "Merhaba! Ben Aron destek asistanıyım 👋 Hangi konuda yardım istersin? Aşağıdan seç." },
  ]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  const push = (m: Omit<SMsg, "id">) => setMsgs((p) => [...p, { id: UID++, ...m }]);

  const pickTopic = (t: Topic) => {
    if (picked && stage !== "bot") return;
    haptic.light();
    setPicked(true);
    push({ role: "user", text: t.label });
    later(() => {
      if (t.type === "solve") {
        push({
          role: "bot",
          text: t.reply,
          actions: [
            { label: t.routeLabel!, type: "route", route: t.route },
            { label: "Sorunum çözülmedi, temsilciye aktar", type: "agent" },
          ],
        });
      } else {
        push({ role: "bot", text: t.reply, actions: [{ label: "Temsilciye Aktar", type: "agent" }] });
      }
    }, 500);
  };

  const toAgent = () => {
    if (stage !== "bot") return;
    haptic.medium();
    setStage("connecting");
    push({ role: "system", tone: "connect", text: "Bir temsilciye aktarılıyorsun…" });
    later(() => {
      setStage("agent");
      push({ role: "system", tone: "connect", text: `${AGENT} sohbete katıldı. Sorununu / şikayetini detaylıca yazabilirsin.` });
      push({ role: "system", tone: "info", text: "Temsilcimiz yoğun olabilir. Uygulamadan çıksan bile, yanıt geldiğinde bildirimlerine düşecek." });
    }, 1300);
  };

  const onAction = (a: Action) => {
    if (a.type === "route" && a.route) { haptic.light(); router.navigate(a.route as never); }
    else if (a.type === "agent") toAgent();
  };

  const send = () => {
    const t = input.trim();
    if (!t || stage !== "agent") return;
    haptic.light();
    push({ role: "user", text: t });
    setInput("");
    if (!complained) {
      setComplained(true);
      later(() => push({ role: "system", tone: "info", text: "Mesajın temsilciye iletildi. Yanıt geldiğinde bildirim alacaksın." }), 700);
      later(() => push({ role: "bot", text: `Merhaba, ben ${AGENT}. Mesajını aldım, kaydını inceleyip en kısa sürede döneceğim 🙏` }), 3200);
    }
  };

  const inAgent = stage === "agent";

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Icon name="back" size={16} color={C.text} />
            </Pressable>
            {inAgent ? (
              <Portrait name={AGENT} size={38} online />
            ) : (
              <Gradient colors={["#60A5FA", "#2563EB"]} deg={135} style={styles.botAvatar}>
                <Icon name="chat" size={18} color="#fff" />
              </Gradient>
            )}
            <View style={{ flex: 1 }}>
              <Txt weight="extrabold" size={13.5} color="#fff">{inAgent ? AGENT : "Aron Destek"}</Txt>
              <Txt weight="bold" size={10} color={inAgent ? C.green : C.dim}>
                {stage === "agent" ? "● Çevrimiçi · Destek temsilcisi" : stage === "connecting" ? "Bağlanıyor…" : "Genelde birkaç dakikada yanıtlar"}
              </Txt>
            </View>
          </View>

          {inAgent && (
            <View style={styles.connectedBanner}>
              <View style={styles.dot} />
              <Txt weight="bold" size={11} color="#6EE7B7" style={{ flex: 1 }}>Temsilciye bağlandın — sorununu / şikayetini yaz.</Txt>
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {msgs.map((m) => {
              if (m.role === "system") {
                return (
                  <Animated.View key={m.id} entering={FadeIn} style={[styles.system, m.tone === "info" && styles.systemInfo]}>
                    <Txt weight="semibold" size={10.5} color={m.tone === "info" ? C.gold2 : C.dim} align="center" lh={1.5}>{m.text}</Txt>
                  </Animated.View>
                );
              }
              if (m.role === "user") {
                return (
                  <Animated.View key={m.id} entering={FadeIn} style={{ alignSelf: "flex-end", maxWidth: "78%" }}>
                    <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={[styles.bubble, { borderTopRightRadius: 5 }]}>
                      <Txt size={12.5} color="#fff" lh={1.5}>{m.text}</Txt>
                    </Gradient>
                  </Animated.View>
                );
              }
              return (
                <Animated.View key={m.id} entering={FadeIn} style={{ alignSelf: "flex-start", maxWidth: "82%" }}>
                  <View style={[styles.bubble, styles.bubbleBot]}>
                    <Txt size={12.5} color={C.text} lh={1.5}>{m.text}</Txt>
                  </View>
                  {m.actions?.map((a, i) => (
                    <Pressable key={i} onPress={() => onAction(a)} style={{ marginTop: 7 }}>
                      {a.type === "route" ? (
                        <View style={styles.routeBtn}>
                          <Txt weight="extrabold" size={11.5} color="#93C5FD">{a.label}</Txt>
                          <Icon name="chev" size={13} color="#93C5FD" />
                        </View>
                      ) : (
                        <View style={styles.agentBtn}>
                          <Icon name="user" size={13} color={C.gold2} />
                          <Txt weight="extrabold" size={11.5} color={C.gold2}>{a.label}</Txt>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </Animated.View>
              );
            })}

            {!picked && (
              <View style={styles.chips}>
                {TOPICS.map((t) => (
                  <Pressable key={t.label} onPress={() => pickTopic(t)} style={styles.chip}>
                    <Txt weight="bold" size={11.5} color={C.text}>{t.label}</Txt>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <View style={[styles.inputWrap, !inAgent && { opacity: 0.5 }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                editable={inAgent}
                placeholder={inAgent ? "Sorununu yaz..." : "Önce bir konu seç"}
                placeholderTextColor={C.dim2}
                style={styles.input}
                returnKeyType="send"
              />
            </View>
            <Pressable onPress={send} disabled={!inAgent || !input.trim()} style={{ borderRadius: 22, overflow: "hidden", opacity: inAgent && input.trim() ? 1 : 0.45 }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.sendBtn}>
                <Icon name="send" size={17} sw={2} color="#241A05" />
              </Gradient>
            </Pressable>
          </View>
        </KeyboardAware>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },
  botAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  connectedBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "rgba(52,211,153,.1)", borderWidth: 1, borderColor: "rgba(52,211,153,.28)" },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green },
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 16 },
  bubbleBot: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderTopLeftRadius: 5 },
  routeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 13, backgroundColor: "rgba(96,165,250,.12)", borderWidth: 1, borderColor: "rgba(96,165,250,.35)" },
  agentBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 13, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}40` },
  system: { alignSelf: "center", maxWidth: "88%", paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.kontrol },
  systemInfo: { backgroundColor: `${C.gold}10`, borderWidth: 1, borderColor: `${C.gold}30` },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  inputRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, alignItems: "center" },
  inputWrap: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, justifyContent: "center" },
  input: { color: C.text, fontSize: 12.5, fontFamily: "PlusJakartaSans_500Medium", paddingVertical: 11 },
  sendBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
