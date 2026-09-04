import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BOS_KUTU from "@/anim/bos-kutu.json";
import { Badge } from "@/components/Badge";
import { BosDurum } from "@/components/BosDurum";
import { KeyboardAware } from "@/components/KeyboardAware";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { FEED_SEED, SCOPE_LABEL, type FeedPost } from "@/data/feed";
import {
  addComment as addCommentDb,
  addReply as addReplyDb,
  deleteComment,
  FEED_ID_OFFSET,
  getPost,
  likePost,
  unlikePost,
} from "@/data/remote/feedRepo";
import { Icon } from "@/icons/Icon";
import { getCached } from "@/lib/cache";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type UserPost = Extract<FeedPost, { type: "user" }>;

/**
 * Gönderi sayfası — yorumların yeri.
 *
 * NEDEN AYRI SAYFA: yorumlar akıştaki kartın ALTINDA açılıyordu. Kart uzuyor,
 * liste zıplıyor, uzun yorum dizisi akışın ortasına gömülüyordu; yanıt yazmak
 * için üç ayrı satır içi kutu vardı (yorum kutusu, yanıt kutusu, düzenleme
 * kutusu) ve klavye açılınca hangisinin açık olduğu kaybolıyordu. Referans
 * uygulamada da yorum ayrı sayfada ve TEK bir alt çubukla yazılıyor.
 *
 * VERİ: sayfa önce listeden gelen kopyayı çiziyor (akışın önbelleği ya da
 * yerel seed), sonra `getPost` ile tazesini koyuyor. Böylece geçiş beklemesiz
 * ama sayılar bayat kalmıyor.
 */
export default function GonderiScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const gonderiId = Number(id);
  const userName = useApp((s) => s.userName);
  const userPhoto = useApp((s) => s.userPhoto);

  /** Listeden gelen kopya — ilk kare için. */
  const ilk = useMemo<UserPost | null>(() => {
    const onbellek = getCached<FeedPost[]>("feed:db") ?? [];
    const bulunan = [...onbellek, ...FEED_SEED].find((p) => p.id === gonderiId && p.type === "user");
    return (bulunan as UserPost) ?? null;
  }, [gonderiId]);

  const [post, setPost] = useState<UserPost | null>(ilk);
  const [begendim, setBegendim] = useState(false);
  const [yazi, setYazi] = useState("");
  /** Yanıtlanan üst yorumun sırası — alt çubuk tek, hedefi bu belirliyor. */
  const [yanit, setYanit] = useState<{ ci: number; who: string } | null>(null);
  const [silindi, setSilindi] = useState(false);
  const [toast, setToast] = useState("");

  const note = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1700); };
  /** DB gönderisi mi (mock seed'in id'si offset'in altında kalıyor). */
  const dbId = gonderiId >= FEED_ID_OFFSET ? gonderiId - FEED_ID_OFFSET : null;
  const canli = dbId != null && isSupabaseConfigured && !!useApp.getState().session;

  useFocusEffect(
    useCallback(() => {
      if (dbId == null || !isSupabaseConfigured) return;
      let alive = true;
      getPost(dbId)
        .then((r) => {
          if (!alive) return;
          if (!r) { setSilindi(true); return; }
          if (r.post.type === "user") setPost(r.post);
          setBegendim(r.liked);
        })
        .catch((e) => console.warn("[gonderi] getPost:", e?.message || e));
      return () => { alive = false; };
    }, [dbId]),
  );

  const goProfile = (publicId: string | undefined, name: string, mine?: boolean) => {
    if (mine) { router.navigate("/profile"); return; }
    const q = publicId ? `publicId=${encodeURIComponent(publicId)}&` : "";
    router.navigate(`/user-profile?${q}name=${encodeURIComponent(name)}`);
  };

  const begen = async () => {
    if (!post) return;
    haptic.select();
    const onceki = begendim;
    setBegendim(!onceki);
    setPost((p) => (p ? { ...p, likes: Math.max(0, p.likes + (onceki ? -1 : 1)) } : p));
    if (!canli || dbId == null) return;
    try {
      if (onceki) await unlikePost(dbId);
      else await likePost(dbId);
    } catch {
      setBegendim(onceki);
      setPost((p) => (p ? { ...p, likes: Math.max(0, p.likes + (onceki ? 1 : -1)) } : p));
    }
  };

  const gonder = async () => {
    const t = yazi.trim();
    if (!t || !post) return;
    haptic.light();
    const hedef = yanit;
    setYazi("");
    setYanit(null);

    // İyimser ekleme: yanıtsa üst yorumun altına, değilse listenin sonuna.
    setPost((p) => {
      if (!p) return p;
      if (hedef) {
        return { ...p, comments: p.comments.map((c, j) => (j === hedef.ci ? { ...c, replies: [...c.replies, { who: userName, text: t, mine: true }] } : c)) };
      }
      return { ...p, comments: [...p.comments, { who: userName, text: t, mine: true, replies: [] }] };
    });

    if (!canli || dbId == null) return;
    try {
      if (hedef) {
        const ustCid = post.comments[hedef.ci]?.cid;
        if (ustCid == null) return;
        await addReplyDb(ustCid, dbId, t);
      } else {
        await addCommentDb(dbId, t);
      }
    } catch {
      note(hedef ? "Yanıt gönderilemedi" : "Yorum gönderilemedi");
    }
  };

  const silYorum = (ci: number) => {
    if (!post) return;
    const cid = post.comments[ci]?.cid;
    setPost((p) => (p ? { ...p, comments: p.comments.filter((_, j) => j !== ci) } : p));
    if (canli && cid != null) deleteComment(cid).catch(() => note("Silinemedi"));
  };

  const silYanit = (ci: number, ri: number) => {
    if (!post) return;
    const cid = post.comments[ci]?.replies[ri]?.cid;
    setPost((p) => (p ? { ...p, comments: p.comments.map((c, j) => (j === ci ? { ...c, replies: c.replies.filter((_, k) => k !== ri) } : c)) } : p));
    if (canli && cid != null) deleteComment(cid).catch(() => note("Silinemedi"));
  };

  const yorumSayisi = post ? post.comments.reduce((s, c) => s + 1 + c.replies.length, 0) : 0;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Icon name="back" size={16} color={C.text} />
            </Pressable>
            <Txt weight="displayBold" size={16} color="#fff">Gönderi</Txt>
          </View>

          {!post ? (
            <BosDurum
              anim={BOS_KUTU}
              baslik={silindi ? "Gönderi bulunamadı" : "Gönderi açılamadı"}
              alt={silindi ? "Bu paylaşım silinmiş olabilir." : "Akışa dönüp tekrar dene."}
            />
          ) : (
            <>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Gönderinin kendisi */}
                <View style={styles.ustSatir}>
                  <Pressable onPress={() => goProfile(post.publicId, post.who, post.mine)} style={styles.kimlik}>
                    <Portrait name={post.who} size={44} photo={post.mine ? userPhoto || undefined : post.photo} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Txt weight="extrabold" size={14} color={post.mine ? C.gold2 : C.text}>{post.mine ? userName : post.who}</Txt>
                        {post.vip && <Badge type="vip" size={15} />}
                        <Txt weight="extrabold" size={10} color="#5EEAD4">LV.{post.lv}</Txt>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                        <Txt size={10.5} color={C.dim2}>{post.when}</Txt>
                        <Txt size={10.5} color={C.dim2}>·</Txt>
                        <Icon path={SCOPE_LABEL[post.scope].ic} size={10} color={C.dim2} />
                        <Txt weight="semibold" size={10} color={C.dim2}>{SCOPE_LABEL[post.scope].t}</Txt>
                      </View>
                    </View>
                  </Pressable>
                </View>

                <Txt size={14.5} color={C.text} lh={1.55} style={{ marginTop: 12 }}>{post.body}</Txt>

                {/* Sayaç satırı — yorum listesinin başlığı yerine geçiyor. */}
                <View style={styles.sayacSatiri}>
                  <Txt weight="extrabold" size={12} color={C.text}>{yorumSayisi} yorum</Txt>
                  <Txt size={12} color={C.dim2}>·</Txt>
                  <Txt weight="bold" size={12} color={C.dim}>{post.likes} beğeni</Txt>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => { haptic.light(); Share.share({ message: post.body }).catch(() => {}); }} hitSlop={8} style={{ padding: 4 }}>
                    <Icon name="share" size={16} color={C.dim} />
                  </Pressable>
                </View>

                {post.comments.length === 0 ? (
                  <BosDurum
                    anim={BOS_KUTU}
                    animBoyut={110}
                    baslik="Henüz yorum yok"
                    alt="İlk yorumu sen yaz."
                    dolgu={30}
                  />
                ) : (
                  post.comments.map((c, ci) => (
                    <View key={c.cid ?? ci} style={{ marginTop: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                        <Pressable onPress={() => goProfile(c.publicId, c.who, c.mine)}>
                          <Portrait name={c.who} size={32} photo={c.mine ? userPhoto || undefined : c.photo} />
                        </Pressable>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight="extrabold" size={12} color={c.mine ? C.gold2 : C.text} onPress={() => goProfile(c.publicId, c.who, c.mine)}>
                            {c.mine ? userName : c.who}
                          </Txt>
                          <Txt size={13} color={C.text} lh={1.45} style={{ marginTop: 3 }}>{c.text}</Txt>
                          <View style={styles.yorumAksiyon}>
                            <Pressable onPress={() => { haptic.select(); setYanit({ ci, who: c.mine ? userName : c.who }); }} hitSlop={6}>
                              <Txt weight="bold" size={11} color={C.dim}>Yanıtla</Txt>
                            </Pressable>
                            {(c.mine || post.mine) && (
                              <Pressable onPress={() => silYorum(ci)} hitSlop={6}>
                                <Txt weight="bold" size={11} color={C.dim2}>Sil</Txt>
                              </Pressable>
                            )}
                          </View>

                          {c.replies.map((r, ri) => (
                            <View key={r.cid ?? ri} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 }}>
                              <Pressable onPress={() => goProfile(r.publicId, r.who, r.mine)}>
                                <Portrait name={r.who} size={26} photo={r.mine ? userPhoto || undefined : r.photo} />
                              </Pressable>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Txt weight="extrabold" size={11.5} color={r.mine ? C.gold2 : C.text} onPress={() => goProfile(r.publicId, r.who, r.mine)}>
                                  {r.mine ? userName : r.who}
                                </Txt>
                                <Txt size={12.5} color={C.text} lh={1.45} style={{ marginTop: 2 }}>{r.text}</Txt>
                                <View style={styles.yorumAksiyon}>
                                  <Pressable onPress={() => { haptic.select(); setYanit({ ci, who: r.mine ? userName : r.who }); setYazi(`@${r.mine ? userName : r.who} `); }} hitSlop={6}>
                                    <Txt weight="bold" size={11} color={C.dim}>Yanıtla</Txt>
                                  </Pressable>
                                  {(r.mine || post.mine) && (
                                    <Pressable onPress={() => silYanit(ci, ri)} hitSlop={6}>
                                      <Txt weight="bold" size={11} color={C.dim2}>Sil</Txt>
                                    </Pressable>
                                  )}
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* TEK yazma çubuğu — yorum da yanıt da buradan gidiyor. */}
              <View style={styles.altCubuk}>
                {yanit && (
                  <View style={styles.yanitSeridi}>
                    <Txt size={11} color={C.dim} style={{ flex: 1 }} numberOfLines={1}>
                      <Txt weight="extrabold" size={11} color={C.gold2}>{yanit.who}</Txt> kişisine yanıt veriyorsun
                    </Txt>
                    <Pressable onPress={() => { setYanit(null); setYazi(""); }} hitSlop={8}>
                      <Txt weight="bold" size={11} color={C.dim2}>Vazgeç</Txt>
                    </Pressable>
                  </View>
                )}
                <View style={styles.cubukSatiri}>
                  <Portrait name="Sen" size={30} photo={userPhoto || undefined} />
                  <TextInput
                    value={yazi}
                    onChangeText={setYazi}
                    placeholder={yanit ? `${yanit.who} kişisine yanıt…` : "Bir şey söyle"}
                    placeholderTextColor={C.dim2}
                    style={styles.girdi}
                    multiline
                  />
                  {yazi.trim() ? (
                    <Pressable onPress={gonder} style={styles.gonderBtn}>
                      <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.gonderDolgu}>
                        <Icon name="send" size={16} color="#241A05" />
                      </Gradient>
                    </Pressable>
                  ) : (
                    <Pressable onPress={begen} style={styles.kalpBtn}>
                      <Icon name="heart" size={19} color={begendim ? "#FB7185" : C.dim} fill={begendim ? "#FB7185" : "none"} />
                      <Txt weight="extrabold" size={11} color={begendim ? "#FB7185" : C.dim}>{post.likes}</Txt>
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          )}

          {toast !== "" && (
            <View style={styles.toast}>
              <Txt weight="bold" size={12} color="#fff">{toast}</Txt>
            </View>
          )}
        </KeyboardAware>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },
  ustSatir: { flexDirection: "row", alignItems: "center", gap: 11 },
  kimlik: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11, minWidth: 0 },
  sayacSatiri: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16, paddingTop: 12, paddingBottom: 2, borderTopWidth: 1, borderTopColor: C.line },
  yorumAksiyon: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 },
  altCubuk: { borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9 },
  yanitSeridi: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8 },
  cubukSatiri: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  girdi: {
    flex: 1,
    minHeight: 38,
    maxHeight: 110,
    color: C.text,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    backgroundColor: C.kontrol,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
  },
  gonderBtn: { width: 38, height: 38, borderRadius: 19, overflow: "hidden" },
  gonderDolgu: { flex: 1, alignItems: "center", justifyContent: "center" },
  kalpBtn: { height: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10 },
  toast: { position: "absolute", alignSelf: "center", bottom: 90, backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: C.gold + "55", paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
});
