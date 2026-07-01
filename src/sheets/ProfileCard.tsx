import { BlurView } from "expo-blur";
import { type ReactNode, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthorityTag } from "@/components/AuthorityTag";
import { BadgeInfoCard, BadgeRow } from "@/components/BadgeRow";
import { Portrait } from "@/components/Portrait";
import { RolePill } from "@/components/RolePill";
import { Txt } from "@/components/Txt";
import { type BadgeItem } from "@/data/badges";
import { reportUserByPublicId } from "@/data/remote/reportRepo";
import { type Seat } from "@/data/seed";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export type ProfileCardUser = Seat & {
  viewerRole?: "host" | "mod" | "user";
  onMute?: () => void;
  onKickMic?: () => void;
  onKickRoom?: () => void;
  /** kendi kartım mı — yönetim aksiyonları gizlenir, kendi profilim açılır */
  self?: boolean;
  /** developer / süper admin → "Yetkili" rozeti gösterilir */
  authority?: boolean;
  /** gerçek profil fotoğrafı (kendi kartım için) */
  photo?: string;
  /** karşı kullanıcının public_id'si → "Profili Gör" gerçek profili açar */
  publicId?: string;
  /** mikrofonda oturuyorsam — kendi kartımdan inebilmek için */
  onLeaveSeat?: () => void;
};

const REPORT_REASONS: { ic: IconName; t: string }[] = [
  { ic: "ban", t: "Taciz veya zorbalık" },
  { ic: "adult", t: "Uygunsuz içerik" },
  { ic: "mask", t: "Sahte hesap" },
  { ic: "spam", t: "Spam" },
  { ic: "warn", t: "Dolandırıcılık" },
  { ic: "warn", t: "Diğer" },
];

const CARD_BADGES: BadgeItem[] = [
  { type: "developer" },
  { type: "vip" },
  { type: "agency", meta: { id: "1", name: "Aron Stars", owner: "Ardaowski" } },
];

function ActionRow({ icon, color, label, onPress }: { icon: IconName; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionRow}>
      <Icon name={icon} size={17} color={color} />
      <Txt weight="bold" size={12.5} color={color} style={{ flex: 1 }}>{label}</Txt>
      <Icon name="chev" size={14} color={C.dim2} />
    </Pressable>
  );
}

function ActionGroup({ children }: { children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <View style={styles.actionGroup}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 && <View style={styles.actionDivider} />}
          {child}
        </View>
      ))}
    </View>
  );
}

export function ProfileCard({
  user,
  onClose,
  onDM,
  onViewProfile,
  superPower = false,
}: {
  user: ProfileCardUser;
  onClose: () => void;
  onDM?: (u: ProfileCardUser) => void;
  onViewProfile?: () => void;
  superPower?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const viewerRole = user.viewerRole || "user";
  const canManage = viewerRole === "host" || viewerRole === "mod" || superPower;
  const isOwner = !!user.host;
  const canManageTarget = canManage && (!isOwner || superPower) && !user.self;

  const [gearOpen, setGearOpen] = useState(false);
  const [badgeInfo, setBadgeInfo] = useState<BadgeItem | null>(null);
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);
  const [followed, setFollowed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reportView, setReportView] = useState(false);
  const [repReason, setRepReason] = useState<string | null>(null);
  const [repDetail, setRepDetail] = useState("");
  const [repDone, setRepDone] = useState(false);

  const showToast = (msg: string, color: string = C.green) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2400);
  };
  const doAction = (label: string, fn?: () => void, color: string = C.green) => {
    fn?.();
    showToast(label, color);
    setGearOpen(false);
    setTimeout(onClose, 600);
  };

  const GEAR = [
    { icon: "micoff" as IconName, label: user.muted ? "Mikrofonu Aç" : "Mikrofonu Sustur", color: C.gold, fn: () => doAction(user.muted ? `${user.name} mikrofonu açıldı.` : `${user.name} susturuldu.`, user.onMute) },
    { icon: "mickick" as IconName, label: "Mikrofondan At", color: C.red, fn: () => doAction(`${user.name} mikrofondan atıldı.`, user.onKickMic, C.red) },
    { icon: "door" as IconName, label: isOwner ? "Oda Sahibini At" : "Odadan Çıkar", color: C.red, fn: () => doAction(isOwner ? `${user.name} (oda sahibi) atıldı.` : `${user.name} odadan çıkarıldı.`, user.onKickRoom, C.red) },
  ];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(280)} style={styles.sheet}>
          <Pressable>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(32,28,44,0.82)", "rgba(14,12,20,0.9)"]} deg={170} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 + insets.bottom }} keyboardShouldPersistTaps="handled">
              {reportView ? (
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <Pressable onPress={() => setReportView(false)} style={styles.iconBtn}>
                      <Icon name="back" size={15} color={C.text} />
                    </Pressable>
                    <Txt weight="displayBold" size={16} color="#fff">Kullanıcıyı Raporla</Txt>
                  </View>
                  {repDone ? (
                    <View style={{ alignItems: "center", paddingVertical: 16 }}>
                      <Gradient colors={[C.green, "#059669"]} deg={135} style={styles.doneIcon}>
                        <Icon name="check" size={28} sw={3} color="#04231A" />
                      </Gradient>
                      <Txt weight="displayBold" size={15} color="#fff">Rapor Gönderildi</Txt>
                      <Txt size={11.5} color={C.dim} style={{ marginTop: 8 }}>Ekibimiz en kısa sürede inceleyecek.</Txt>
                      <Pressable onPress={onClose} style={{ alignSelf: "stretch", marginTop: 20, borderRadius: 14, overflow: "hidden" }}>
                        <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 13, alignItems: "center" }}>
                          <Txt weight="extrabold" size={13} color="#241A05">Kapat</Txt>
                        </Gradient>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <Txt size={11.5} color={C.dim} style={{ marginBottom: 12 }}>Neden raporluyorsun?</Txt>
                      {REPORT_REASONS.map((r) => {
                        const on = repReason === r.t;
                        return (
                          <Pressable key={r.t} onPress={() => setRepReason(r.t)} style={[styles.reasonRow, { backgroundColor: on ? C.red + "12" : C.card, borderColor: on ? C.red : C.line }]}>
                            <View style={styles.reasonIcon}>
                              <Icon name={r.ic} size={16} color="#FB7185" />
                            </View>
                            <Txt weight="bold" size={12.5} color={on ? C.red : C.text} style={{ flex: 1 }}>{r.t}</Txt>
                            {on && <Icon name="check" size={15} sw={3} color={C.red} />}
                          </Pressable>
                        );
                      })}
                      {repReason && (
                        <>
                          <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.4, marginTop: 14, marginBottom: 7 }}>DETAY (opsiyonel)</Txt>
                          <TextInput value={repDetail} onChangeText={setRepDetail} multiline maxLength={300} placeholder={`${user.name} hakkında daha fazla bilgi ver...`} placeholderTextColor={C.dim2} style={styles.detailInput} />
                          <Pressable
                            onPress={() => {
                              setRepDone(true);
                              if (isSupabaseConfigured && user.publicId && repReason) {
                                reportUserByPublicId(user.publicId, repReason, repDetail).catch(() => {});
                              }
                            }}
                            style={{ borderRadius: 14, overflow: "hidden", marginTop: 12 }}
                          >
                            <Gradient colors={["#DC2626", "#7F1D1D"]} deg={135} style={{ paddingVertical: 14, alignItems: "center" }}>
                              <Txt weight="extrabold" size={13} color="#FEE2E2">Raporu Gönder</Txt>
                            </Gradient>
                          </Pressable>
                        </>
                      )}
                    </>
                  )}
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Pressable onPress={onClose} style={styles.iconBtn}>
                      <Icon name="x" size={15} color={C.text} />
                    </Pressable>
                    {canManageTarget ? (
                      <Pressable onPress={() => setGearOpen((v) => !v)} style={[styles.iconBtn, { borderColor: gearOpen ? C.gold : C.line, backgroundColor: gearOpen ? C.gold + "14" : "rgba(255,255,255,.05)" }]}>
                        <Icon name="gear" size={16} color={gearOpen ? C.gold : C.text} />
                      </Pressable>
                    ) : (
                      <View style={{ width: 34 }} />
                    )}
                  </View>

                  {gearOpen && canManageTarget && (
                    <View style={styles.gearMenu}>
                      <Txt weight="bold" size={9} color={C.dim} style={{ padding: 12, paddingBottom: 6, letterSpacing: 0.5 }}>YÖNETİCİ İŞLEMLERİ</Txt>
                      {GEAR.map((a) => (
                        <Pressable key={a.label} onPress={a.fn} style={styles.gearItem}>
                          <Icon name={a.icon} size={16} color={a.color} />
                          <Txt weight="bold" size={12.5} color={a.color}>{a.label}</Txt>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {toast && (
                    <View style={{ marginTop: 8, backgroundColor: toast.color + "18", borderWidth: 1, borderColor: toast.color + "44", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}>
                      <Txt weight="bold" size={11.5} color={toast.color} align="center">{toast.msg}</Txt>
                    </View>
                  )}

                  <View style={{ alignItems: "center", marginTop: toast ? 8 : 0 }}>
                    <Portrait name={user.name} size={88} ring={isOwner ? C.gold : C.purple2} glow online frameBorder="#101016" photo={user.photo} />
                    <Txt weight="displayBold" size={20} color="#fff" style={{ marginTop: 10 }}>{user.name}</Txt>
                    <View style={{ flexDirection: "row", gap: 7, marginTop: 9, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                      {isOwner && <RolePill type="host" />}
                      {user.mod && !isOwner && <RolePill type="mod" />}
                      {user.authority && <AuthorityTag />}
                      <BadgeRow size={28} badges={CARD_BADGES} onBadgePress={setBadgeInfo} />
                    </View>
                    <View style={{ marginTop: 9 }}>
                      {isOwner ? (
                        <View style={styles.idPill}>
                          <Icon name="idcard" size={12} color={C.gold2} />
                          <Txt weight="extrabold" size={11} color={C.gold2}>ID: {user.publicId || "11111"}</Txt>
                        </View>
                      ) : (
                        <Txt weight="semibold" size={11} color={C.dim}>ID: {user.publicId || "48" + user.lv}</Txt>
                      )}
                    </View>
                  </View>

                  {user.self ? (
                    <View style={{ marginTop: 16 }}>
                      <ActionGroup>
                        <ActionRow icon="user" color={C.text} label="Profilini Görüntüle" onPress={() => { onViewProfile?.(); onClose(); }} />
                        {user.onLeaveSeat && (
                          <ActionRow icon="micoff" color={C.red} label="Mikrofondan in" onPress={() => { user.onLeaveSeat?.(); onClose(); }} />
                        )}
                      </ActionGroup>
                    </View>
                  ) : (
                    <View style={{ marginTop: 16 }}>
                      <ActionGroup>
                        <ActionRow icon="user" color={C.text} label="Profilini Görüntüle" onPress={() => { onViewProfile?.(); onClose(); }} />
                        <ActionRow icon="chat" color={C.text} label="Mesaj Gönder" onPress={() => { onDM?.(user); onClose(); }} />
                        <ActionRow icon="userAdd" color={followed ? C.dim : C.text} label={followed ? "Takipten Çık" : "Takip Et"} onPress={() => { setFollowed((v) => !v); showToast(followed ? `${user.name} takipten çıkıldı.` : `${user.name} takip edildi.`); }} />
                        <ActionRow icon="blockuser" color={blocked ? C.dim : C.red} label={blocked ? "Engeli Kaldır" : "Engelle"} onPress={() => { setBlocked((v) => !v); showToast(blocked ? `${user.name} engeli kaldırıldı.` : `${user.name} engellendi.`); }} />
                        <ActionRow icon="flag" color={C.red} label="Kullanıcıyı Raporla" onPress={() => setReportView(true)} />
                      </ActionGroup>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
        {badgeInfo && <BadgeInfoCard info={badgeInfo} onClose={() => setBadgeInfo(null)} />}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.6)" },
  sheet: { maxHeight: "82%", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.16)", backgroundColor: "rgba(16,14,22,0.6)" },
  glint: { position: "absolute", top: 0, left: 40, right: 40, height: 1, backgroundColor: "rgba(255,255,255,.55)" },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  gearMenu: { position: "absolute", right: 20, top: 56, width: 210, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(28,24,40,0.98)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)", zIndex: 10 },
  gearItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: C.line },
  idPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999, backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "44" },
  actionGroup: { borderRadius: 16, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", overflow: "hidden" },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 43 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 13, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1 },
  reasonIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.12)", borderWidth: 1, borderColor: "rgba(251,113,133,.25)" },
  detailInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, color: C.text, fontSize: 12.5, fontFamily: "PlusJakartaSans_500Medium", height: 84, textAlignVertical: "top" },
  doneIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14 },
});
