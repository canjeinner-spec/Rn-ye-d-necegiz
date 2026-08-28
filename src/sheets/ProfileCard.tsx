import { BlurView } from "expo-blur";
import { type ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthorityTag } from "@/components/AuthorityTag";
import { EquippedBadge } from "@/components/EquippedBadge";
import { KeyboardAware } from "@/components/KeyboardAware";
import { OzelIdGosterim } from "@/components/OzelId";
import { PngBadge } from "@/components/PngBadge";
import { Portrait } from "@/components/Portrait";
import { RolePill } from "@/components/RolePill";
import { Txt } from "@/components/Txt";
import { levelTierBadge } from "@/data/badges";
import { getFollowCounts } from "@/data/remote/followRepo";
import { getPublicProfile, type PublicProfile } from "@/data/remote/profileRepo";
import { reportUserByPublicId } from "@/data/remote/reportRepo";
import { type Seat } from "@/data/seed";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
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

const CINSIYET: Record<string, string> = { erkek: "Erkek", kadin: "Kadın", diger: "Diğer" };

function sayi(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")}B` : String(n);
}

/** Üçlü istatistik şeridi — takipçi / takip / seviye. */
function Stat({ deger, etiket, renk }: { deger: string; etiket: string; renk?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}>
      <Txt weight="displayBold" size={15} color={renk ?? "#fff"}>{deger}</Txt>
      <Txt weight="semibold" size={9} color={C.dim2} style={{ marginTop: 2, letterSpacing: 0.3 }}>{etiket}</Txt>
    </View>
  );
}

/** Öne çıkan aksiyon — kartın altındaki üçlü buton sırası. */
function PrimaryAction({ icon, label, tint, filled, onPress }: { icon: IconName; label: string; tint: string; filled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View style={[styles.primaryBtn, filled ? { backgroundColor: tint + "1F", borderColor: tint + "66" } : null]}>
        <Icon name={icon} size={17} color={tint} />
        <Txt weight="extrabold" size={10.5} color={tint} numberOfLines={1}>{label}</Txt>
      </View>
    </Pressable>
  );
}

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
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
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
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);
  const [followed, setFollowed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reportView, setReportView] = useState(false);
  const [repReason, setRepReason] = useState<string | null>(null);
  const [repDetail, setRepDetail] = useState("");
  const [repDone, setRepDone] = useState(false);

  // ---- Gerçek profil verisi ------------------------------------------------
  // Kart eskiden herkese aynı sabit rozetleri (developer + VIP + ajans)
  // gösteriyordu; hepsi demo veriydi. Artık kart açılınca kişinin gerçek
  // profili çekiliyor: seviye, kuşandığı rozet, özel kimliği, biyografisi.
  const [profil, setProfil] = useState<PublicProfile | null>(null);
  const [takip, setTakip] = useState<{ followers: number; following: number } | null>(null);

  // Kendi kartımda store zaten güncel — ağ beklemeden göster.
  const myOzelId = useApp((s) => s.ozelId);
  const myOzelIdTip = useApp((s) => s.ozelIdTip);
  const myOzelIdTema = useApp((s) => s.ozelIdTema);
  const myKusanilanRozet = useApp((s) => s.kusanilanRozet);
  const myLevel = useApp((s) => s.userLevel);

  useEffect(() => {
    if (!isSupabaseConfigured || !user.publicId) return;
    let alive = true;
    getPublicProfile(user.publicId)
      .then((p) => {
        if (!alive || !p) return;
        setProfil(p);
        return getFollowCounts(p.id).then((c) => { if (alive) setTakip(c); });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user.publicId]);

  // Kendi kartımda store, başkasınınkinde DB; ikisi de yoksa koltuk verisi.
  const seviye = user.self ? myLevel : (profil?.seviye_id ?? user.lv ?? 0);
  const kusanilan = user.self ? myKusanilanRozet : profil?.kusanilan_rozet;
  const ozelId = user.self ? myOzelId : profil?.ozel_id;
  const ozelIdTip = user.self ? myOzelIdTip : profil?.ozel_id_tip;
  const ozelIdTema = user.self ? myOzelIdTema : profil?.ozel_id_tema;
  const foto = user.photo || profil?.profil_resmi || undefined;
  const bio = profil?.biyografi?.trim();
  const yer = [profil?.sehir, profil?.ulke].filter(Boolean).join(", ");
  const cinsiyet = profil?.cinsiyet ? CINSIYET[profil.cinsiyet] : null;

  // Kartın tüm vurgusu role göre: sahip altın, yardımcı turkuaz, üye mor.
  const vurgu = isOwner ? C.gold : user.mod ? "#5EEAD4" : C.purple2;

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
      <KeyboardAware behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SlideInDown.duration(280)} style={styles.sheet}>
          <Pressable>
            {/* Rozet açıklama kartıyla aynı cam doku: yoğun bulanıklık, çok düşük
                dolgu opaklığı. Arkadaki oda hafifçe görünsün diye kalın gradyan yok. */}
            <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(30,26,42,0.30)", "rgba(12,11,18,0.42)"]} deg={170} style={StyleSheet.absoluteFill} pointerEvents="none" />

            {/* Role göre renklenen tepe ışığı + üst kenardaki ince parıltı */}
            {!reportView && (
              <>
                <Gradient colors={[vurgu + "3D", vurgu + "12", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />
                <Gradient colors={["transparent", vurgu + "AA", "transparent"]} deg={90} style={styles.glint} pointerEvents="none" />
              </>
            )}

            <ScrollView contentContainerStyle={{ padding: 17, paddingBottom: 20 + insets.bottom }} keyboardShouldPersistTaps="handled">
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

                  {/* ---- Künye ---- */}
                  <View style={{ alignItems: "center", marginTop: toast ? 8 : 0 }}>
                    <View>
                      {/* avatarın arkasındaki yumuşak hale */}
                      <View style={[styles.avatarHalo, { backgroundColor: vurgu + "1F", shadowColor: vurgu }]} pointerEvents="none" />
                      <Portrait name={user.name} size={78} ring={vurgu} glow online frameBorder="#101016" photo={foto} />
                    </View>

                    <Txt weight="displayBold" size={18} color="#fff" style={{ marginTop: 10 }} numberOfLines={1}>{user.name}</Txt>

                    {/* Roller + rozetler. Seviye burada profildeki gibi RÜTBE ROZETİ
                        olarak duruyor — avatarın üstünde ayrı bir "LV" yazısı yok,
                        iki ekran aynı şeyi aynı biçimde gösteriyor. */}
                    <View style={styles.rozetSatiri}>
                      {isOwner && <RolePill type="host" />}
                      {user.mod && !isOwner && <RolePill type="mod" />}
                      {user.authority && <AuthorityTag />}
                      <PngBadge name={levelTierBadge(seviye)} size={28} />
                      <EquippedBadge kod={kusanilan} size={28} />
                    </View>

                    {/* Kimlik — özel kimliği varsa kapsülü, yoksa sade ID */}
                    <View style={{ marginTop: 11 }}>
                      {ozelId ? (
                        <OzelIdGosterim id={ozelId} tip={ozelIdTip} tema={ozelIdTema} premiumWidth={104} kapsulSize={10} />
                      ) : (
                        <View style={[styles.idPill, { backgroundColor: vurgu + "16", borderColor: vurgu + "3D" }]}>
                          <Icon name="idcard" size={12} color={vurgu} />
                          <Txt weight="extrabold" size={11} color={vurgu}>ID: {user.publicId || "—"}</Txt>
                        </View>
                      )}
                    </View>

                    {/* Ülke / cinsiyet — varsa */}
                    {(yer || cinsiyet) && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 9 }}>
                        {!!yer && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Icon name="pin" size={11} color={C.dim2} />
                            <Txt weight="semibold" size={10.5} color={C.dim}>{yer}</Txt>
                          </View>
                        )}
                        {!!cinsiyet && <Txt weight="semibold" size={10.5} color={C.dim}>{cinsiyet}</Txt>}
                      </View>
                    )}
                  </View>

                  {/* ---- İstatistik şeridi ---- */}
                  <View style={styles.statStrip}>
                    <Stat deger={takip ? sayi(takip.followers) : "—"} etiket="TAKİPÇİ" />
                    <View style={styles.statDivider} />
                    <Stat deger={takip ? sayi(takip.following) : "—"} etiket="TAKİP" />
                    <View style={styles.statDivider} />
                    <Stat deger={String(seviye)} etiket="SEVİYE" renk="#5EEAD4" />
                  </View>

                  {/* ---- Biyografi ---- */}
                  {!!bio && (
                    <View style={styles.bioKutu}>
                      <Txt size={12} color={C.text} lh={1.55} numberOfLines={3} style={{ fontStyle: "italic" }}>{bio}</Txt>
                    </View>
                  )}

                  {user.self ? (
                    <View style={{ marginTop: 16 }}>
                      <ActionGroup>
                        <ActionRow icon="user" color={C.text} label="Profilini Görüntüle" onPress={() => { onViewProfile?.(); onClose(); }} />
                        {user.onLeaveSeat ? (
                          <ActionRow icon="micoff" color={C.red} label="Mikrofondan in" onPress={() => { user.onLeaveSeat?.(); onClose(); }} />
                        ) : null}
                      </ActionGroup>
                    </View>
                  ) : (
                    <>
                      {/* ---- Öne çıkan üç aksiyon ---- */}
                      <View style={{ flexDirection: "row", gap: 9, marginTop: 16 }}>
                        <PrimaryAction icon="chat" label="Mesaj" tint={C.gold2} onPress={() => { onDM?.(user); onClose(); }} />
                        <PrimaryAction
                          icon={followed ? "check" : "heart"}
                          label={followed ? "Takiptesin" : "Takip Et"}
                          tint={followed ? "#6EE7B7" : C.text}
                          filled={followed}
                          onPress={() => { setFollowed((v) => !v); showToast(followed ? `${user.name} takipten çıkıldı.` : `${user.name} takip edildi.`); }}
                        />
                        <PrimaryAction icon="user" label="Profil" tint={C.text} onPress={() => { onViewProfile?.(); onClose(); }} />
                      </View>

                      {/* ---- Sessiz ikincil işlemler ---- */}
                      <View style={{ marginTop: 12 }}>
                        <ActionGroup>
                          <ActionRow icon="blockuser" color={blocked ? C.dim : C.red} label={blocked ? "Engeli Kaldır" : "Engelle"} onPress={() => { setBlocked((v) => !v); showToast(blocked ? `${user.name} engeli kaldırıldı.` : `${user.name} engellendi.`); }} />
                          <ActionRow icon="flag" color={C.red} label="Kullanıcıyı Raporla" onPress={() => setReportView(true)} />
                        </ActionGroup>
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </KeyboardAware>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.34)" },
  sheet: { maxHeight: "78%", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.20)", backgroundColor: "rgba(16,14,22,.30)" },
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 190 },
  glint: { position: "absolute", top: 0, left: 34, right: 34, height: 1.5 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  gearMenu: { position: "absolute", right: 20, top: 56, width: 210, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(28,24,40,0.98)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)", zIndex: 10 },
  gearItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: C.line },
  avatarHalo: { position: "absolute", top: -13, left: -13, right: -13, bottom: -13, borderRadius: 60, shadowOpacity: 0.85, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  rozetSatiri: { flexDirection: "row", gap: 7, marginTop: 9, alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  idPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4.5, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1 },
  statStrip: { flexDirection: "row", alignItems: "center", marginTop: 15, borderRadius: 16, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: "rgba(255,255,255,.14)" },
  bioKutu: { marginTop: 10, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 13, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)" },
  primaryBtn: { alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, borderRadius: 14, backgroundColor: "rgba(255,255,255,.07)", borderWidth: 1, borderColor: "rgba(255,255,255,.13)" },
  actionGroup: { borderRadius: 14, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)", overflow: "hidden" },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.10)", marginLeft: 43 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 13, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1 },
  reasonIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.12)", borderWidth: 1, borderColor: "rgba(251,113,133,.25)" },
  detailInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, color: C.text, fontSize: 12.5, fontFamily: "PlusJakartaSans_500Medium", height: 84, textAlignVertical: "top" },
  doneIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14 },
});
