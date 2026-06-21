import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthorityTag } from "@/components/AuthorityTag";
import { Badge } from "@/components/Badge";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Sheet } from "@/components/Sheet";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { FEED_SEED, SCOPE_LABEL, type FeedPost, type FeedScope } from "@/data/feed";
import { addComment as addCommentDb, addReply as addReplyDb, createPost, deleteComment, deletePost, editPost, FEED_ID_OFFSET, likePost, listPosts, setPinned, unlikePost } from "@/data/remote/feedRepo";
import { getUnreadCount } from "@/data/remote/notifRepo";
import { ROOMS } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type UserPost = Extract<FeedPost, { type: "user" }>;

function ScopeLine({ scope, size = 12 }: { scope: FeedScope; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon path={SCOPE_LABEL[scope].ic} size={size} color={C.dim2} />
      <Txt weight="semibold" size={10} color={C.dim2}>{SCOPE_LABEL[scope].t}</Txt>
    </View>
  );
}

function SendBtn({ disabled, onPress, size = 34 }: { disabled: boolean; onPress: () => void; size?: number }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", opacity: disabled ? 0.4 : 1 }}>
      <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Icon name="send" size={size * 0.44} color="#241A05" />
      </Gradient>
    </Pressable>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const userPhoto = useApp((s) => s.userPhoto);
  const userName = useApp((s) => s.userName);
  const privileged = useApp((s) => s.role !== "user");
  const enterRoom = useApp((s) => s.enterRoom);

  const [tab, setTab] = useState(0);
  const [composer, setComposer] = useState(false);
  const [text, setText] = useState("");
  const [sharing, setSharing] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>(FEED_SEED);
  const [notifUnread, setNotifUnread] = useState(0);

  // Bildirim çanı için okunmamış sayısı (ekrana her gelişte)
  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      let alive = true;
      getUnreadCount().then((c) => { if (alive) setNotifUnread(c); }).catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  // Gerçek gönderileri DB'den yükle (üstte), mock seed altta. Ekrana her dönüşte tazele.
  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      let alive = true;
      listPosts()
        .then(({ posts: db, likedIds }) => {
          if (!alive) return;
          setPosts([...db, ...FEED_SEED]);
          setLiked((prev) => { const next = { ...prev }; for (const id of likedIds) next[id] = true; return next; });
        })
        .catch((e) => console.warn("[feed] listPosts:", e?.message || e));
      return () => { alive = false; };
    }, []),
  );
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [openCmt, setOpenCmt] = useState<number | null>(null);
  const [cmtText, setCmtText] = useState("");
  const [menuPost, setMenuPost] = useState<UserPost | null>(null);
  const [scopePost, setScopePost] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyTo] = useState<{ pid: number; ci: number } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [toast, setToast] = useState("");
  const nextId = useRef(100);

  const note = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1700); };
  const mapUser = (id: number, fn: (p: UserPost) => UserPost) =>
    setPosts((ps) => ps.map((x) => (x.type === "user" && x.id === id ? fn(x) : x)));

  const share = async () => {
    const body = text.trim();
    if (!body || sharing) return;
    haptic.light();
    // Supabase: kalıcı paylaş
    if (isSupabaseConfigured && useApp.getState().session) {
      setSharing(true);
      try {
        const post = await createPost(body);
        setPosts((p) => [post, ...p]);
        setText("");
        setComposer(false);
      } catch {
        note("Paylaşılamadı, tekrar dene");
      } finally {
        setSharing(false);
      }
      return;
    }
    // Yerel (Supabase yoksa)
    setPosts((p) => [{ id: nextId.current++, type: "user", who: "Sen", lv: 32, vip: true, body, when: "şimdi", likes: 0, room: null, comments: [], scope: "herkes", mine: true }, ...p]);
    setText("");
    setComposer(false);
  };
  const toggleLike = async (id: number) => {
    haptic.select();
    const wasLiked = !!liked[id];
    // optimistik: hem kalp rengi hem sayaç
    setLiked((l) => ({ ...l, [id]: !wasLiked }));
    mapUser(id, (x) => ({ ...x, likes: Math.max(0, x.likes + (wasLiked ? -1 : 1)) }));
    if (id >= FEED_ID_OFFSET && isSupabaseConfigured && useApp.getState().session) {
      try {
        if (wasLiked) await unlikePost(id - FEED_ID_OFFSET);
        else await likePost(id - FEED_ID_OFFSET);
      } catch {
        // geri al
        setLiked((l) => ({ ...l, [id]: wasLiked }));
        mapUser(id, (x) => ({ ...x, likes: Math.max(0, x.likes + (wasLiked ? 1 : -1)) }));
      }
    }
  };
  const isDb = (id: number) => id >= FEED_ID_OFFSET && isSupabaseConfigured && useApp.getState().session;

  const goProfile = (publicId: string | undefined, name: string, mine?: boolean) => {
    haptic.light();
    if (mine) { router.navigate("/profile"); return; }
    const q = publicId ? `publicId=${encodeURIComponent(publicId)}&` : "";
    router.navigate(`/user-profile?${q}name=${encodeURIComponent(name)}`);
  };
  const openProfile = (p: UserPost) => goProfile(p.publicId, p.who, p.mine);

  const delPost = (id: number) => {
    setPosts((p) => p.filter((x) => x.id !== id));
    setMenuPost(null);
    note("Paylaşım silindi");
    if (isDb(id)) deletePost(id - FEED_ID_OFFSET).catch(() => note("Silinemedi"));
  };
  const saveEdit = (id: number) => {
    const t = editText.trim();
    mapUser(id, (x) => ({ ...x, body: t || x.body, when: "düzenlendi" }));
    setEditId(null);
    if (t && isDb(id)) editPost(id - FEED_ID_OFFSET, t).catch(() => note("Düzenlenemedi"));
  };
  const togglePin = (id: number) => {
    const cur = posts.find((x) => x.type === "user" && x.id === id);
    const willPin = cur && cur.type === "user" ? !cur.pinned : true;
    mapUser(id, (x) => ({ ...x, pinned: willPin }));
    setMenuPost(null);
    note(willPin ? "Sabitlendi" : "Sabit kaldırıldı");
    if (isDb(id)) setPinned(id - FEED_ID_OFFSET, willPin).catch(() => {});
  };
  const setScope = (id: number, sc: FeedScope) => { mapUser(id, (x) => ({ ...x, scope: sc })); setScopePost(null); };
  const addComment = async (id: number) => {
    const t = cmtText.trim();
    if (!t) return;
    mapUser(id, (x) => ({ ...x, comments: [...x.comments, { who: userName, text: t, mine: true, replies: [] }] }));
    setCmtText("");
    if (id >= FEED_ID_OFFSET && isSupabaseConfigured && useApp.getState().session) {
      try { await addCommentDb(id - FEED_ID_OFFSET, t); } catch { note("Yorum gönderilemedi"); }
    }
  };
  const delComment = (id: number, ci: number) => {
    const post = posts.find((x) => x.type === "user" && x.id === id);
    const cid = post && post.type === "user" ? post.comments[ci]?.cid : undefined;
    mapUser(id, (x) => ({ ...x, comments: x.comments.filter((_, j) => j !== ci) }));
    if (isDb(id) && cid != null) deleteComment(cid).catch(() => note("Silinemedi"));
  };
  const delReply = (id: number, ci: number, ri: number) => {
    const post = posts.find((x) => x.type === "user" && x.id === id);
    const rid = post && post.type === "user" ? post.comments[ci]?.replies[ri]?.cid : undefined;
    mapUser(id, (x) => ({ ...x, comments: x.comments.map((c, j) => (j === ci ? { ...c, replies: c.replies.filter((_, k) => k !== ri) } : c)) }));
    if (isDb(id) && rid != null) deleteComment(rid).catch(() => note("Silinemedi"));
  };
  const addReply = async (pid: number, ci: number) => {
    const t = replyText.trim();
    if (!t) return;
    const post = posts.find((x) => x.type === "user" && x.id === pid);
    const parentCid = post && post.type === "user" ? post.comments[ci]?.cid : undefined;
    mapUser(pid, (x) => ({ ...x, comments: x.comments.map((c, j) => (j === ci ? { ...c, replies: [...c.replies, { who: userName, text: t, mine: true }] } : c)) }));
    setReplyText("");
    setReplyTo(null);
    if (isDb(pid) && parentCid != null) {
      try { await addReplyDb(parentCid, pid - FEED_ID_OFFSET, t); } catch { note("Yanıt gönderilemedi"); }
    }
  };
  const joinRoom = (id: string) => {
    const r = ROOMS.find((x) => x.id === id);
    if (!r) return;
    haptic.light();
    enterRoom(r);
    router.navigate("/room");
  };

  const totalComments = (p: UserPost) => p.comments.reduce((s, c) => s + 1 + c.replies.length, 0);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <View style={{ width: 34 }} />
          <Txt weight="displayBold" size={17} color="#fff" style={{ letterSpacing: 0.5 }}>Akış</Txt>
          <Pressable onPress={() => { haptic.light(); router.navigate("/notifications"); }} style={styles.iconBtn}>
            <Icon name="bell" size={18} color={C.text} />
            {notifUnread > 0 && (
              <View style={styles.bellBadge}>
                <Txt weight="extrabold" size={8.5} color="#fff">{notifUnread > 99 ? "99+" : notifUnread}</Txt>
              </View>
            )}
          </Pressable>
        </View>

        <Tabs items={["Akış", "Takip Edilen"]} active={tab} set={setTab} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Composer */}
          {!composer ? (
            <Pressable onPress={() => setComposer(true)} style={styles.composerTrigger}>
              <Portrait name="Sen" size={38} photo={userPhoto || undefined} />
              <Txt size={13} color={C.dim2} style={{ flex: 1 }}>Bir şeyler paylaş…</Txt>
              <View style={styles.shareChip}>
                <Icon name="evStar" size={13} color={C.gold2} />
                <Txt weight="extrabold" size={11.5} color={C.gold2}>Paylaş</Txt>
              </View>
            </Pressable>
          ) : (
            <View style={styles.composer}>
              <View style={{ flexDirection: "row", gap: 11 }}>
                <Portrait name="Sen" size={38} photo={userPhoto || undefined} />
                <TextInput value={text} onChangeText={setText} maxLength={200} multiline autoFocus placeholder="Ne paylaşmak istersin?" placeholderTextColor={C.dim2} style={styles.composerInput} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 49 }}>
                <Txt size={10} color={C.dim2}>{text.length}/200</Txt>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => { setComposer(false); setText(""); }} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                  <Txt weight="bold" size={12} color={C.dim}>İptal</Txt>
                </Pressable>
                <Pressable onPress={share} disabled={!text.trim() || sharing} style={{ borderRadius: 999, overflow: "hidden", opacity: text.trim() && !sharing ? 1 : 0.45 }}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 8, paddingHorizontal: 18 }}>
                    <Txt weight="extrabold" size={12.5} color="#241A05">{sharing ? "Paylaşılıyor…" : "Paylaş"}</Txt>
                  </Gradient>
                </Pressable>
              </View>
            </View>
          )}

          {posts.map((p) =>
            p.type === "system" ? (
              <View key={p.id} style={styles.postBlock}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Gradient colors={["#F5CE6E", "#B45309"]} deg={135} style={styles.sysIcon}>
                    <Icon name="crown" size={18} color="#3A2A05" />
                  </Gradient>
                  <View style={{ flex: 1 }}>
                    <Txt weight="extrabold" size={13} color={C.gold2}>{p.who}</Txt>
                    <Txt size={10} color={C.dim2} style={{ marginTop: 1 }}>{p.when}</Txt>
                  </View>
                </View>
                <Txt size={12.5} color={C.text} lh={1.5} style={{ marginVertical: 10 }}>
                  <Txt weight="extrabold" size={12.5} color={C.text}>{p.title}</Txt> {p.body}
                </Txt>
                <Gradient colors={[p.spotlight.c1, p.spotlight.c2]} deg={110} style={styles.spotlight}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="displayBold" size={15} color="#fff">{p.spotlight.name}</Txt>
                    <Txt weight="bold" size={11} color="rgba(255,255,255,.9)" style={{ marginTop: 3 }}>{p.spotlight.sub}</Txt>
                  </View>
                  <Portrait name={p.spotlight.name} size={44} ring="rgba(255,255,255,.6)" />
                </Gradient>
              </View>
            ) : (
              <View key={p.id} style={styles.postBlock}>
                {p.pinned && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 }}>
                    <Icon name="pin" size={12} color={C.gold2} />
                    <Txt weight="bold" size={10} color={C.gold2}>Sabitlenmiş paylaşım</Txt>
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <Pressable onPress={() => openProfile(p)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <Portrait name={p.who} size={42} online photo={p.mine ? userPhoto || undefined : p.photo} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Txt weight="extrabold" size={13} color={p.mine ? C.gold2 : C.text}>{p.mine ? userName : p.who}</Txt>
                        {p.mine && privileged && <AuthorityTag size={8} />}
                        {p.vip && <Badge type="vip" size={15} />}
                        <Txt weight="extrabold" size={10} color="#5EEAD4">LV.{p.lv}</Txt>
                      </View>
                      <Txt size={10} color={C.dim2} style={{ marginTop: 2 }}>{p.when}</Txt>
                    </View>
                  </Pressable>
                  {p.mine && (
                    <Pressable onPress={() => setMenuPost(p)} style={{ padding: 6 }}>
                      <Icon name="dots" size={18} color={C.dim2} />
                    </Pressable>
                  )}
                </View>

                {editId === p.id ? (
                  <View style={{ marginTop: 11 }}>
                    <TextInput value={editText} onChangeText={setEditText} maxLength={200} multiline autoFocus style={styles.editInput} />
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                      <Pressable onPress={() => setEditId(null)} style={{ paddingVertical: 8, paddingHorizontal: 14 }}>
                        <Txt weight="bold" size={12} color={C.dim}>İptal</Txt>
                      </Pressable>
                      <Pressable onPress={() => saveEdit(p.id)} style={{ borderRadius: 10, overflow: "hidden" }}>
                        <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 8, paddingHorizontal: 18 }}>
                          <Txt weight="extrabold" size={12.5} color="#241A05">Kaydet</Txt>
                        </Gradient>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setOpenCmt(openCmt === p.id ? null : p.id)}>
                    <Txt size={13} color={C.text} lh={1.55} style={{ marginTop: 11 }}>{p.body}</Txt>
                  </Pressable>
                )}

                {p.room && (
                  <Pressable onPress={() => p.room && joinRoom(p.room.id)} style={styles.roomCard}>
                    <View style={styles.roomThumb}><Scene kind="club" /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Icon name="mic" size={12} color={C.gold2} />
                        <Txt weight="extrabold" size={9.5} color={C.gold2} style={{ letterSpacing: 0.3 }}>CANLI ODA</Txt>
                      </View>
                      <Txt weight="extrabold" size={13} color="#fff" numberOfLines={1} style={{ marginTop: 3 }}>{p.room.name}</Txt>
                      <Txt size={10} color={C.dim} style={{ marginTop: 1 }}>ID: {p.room.id}</Txt>
                    </View>
                    <View style={styles.joinChip}>
                      <Txt weight="extrabold" size={11} color={C.gold2}>Katıl</Txt>
                      <Icon name="chev" size={13} color={C.gold2} />
                    </View>
                  </Pressable>
                )}

                <View style={{ marginTop: 10 }}>
                  <ScopeLine scope={p.scope} />
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 22, marginTop: 11 }}>
                  <Pressable onPress={() => toggleLike(p.id)} style={styles.action}>
                    <Icon name="heart" size={16} color={liked[p.id] ? "#FB7185" : C.dim} fill={liked[p.id] ? "#FB7185" : "none"} />
                    <Txt weight="bold" size={11.5} color={liked[p.id] ? "#FB7185" : C.dim}>{p.likes}</Txt>
                  </Pressable>
                  <Pressable onPress={() => setOpenCmt(openCmt === p.id ? null : p.id)} style={styles.action}>
                    <Icon name="chat" size={16} color={openCmt === p.id ? C.gold2 : C.dim} />
                    <Txt weight="bold" size={11.5} color={openCmt === p.id ? C.gold2 : C.dim}>{totalComments(p)}</Txt>
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <Icon name="share" size={16} color={C.dim} />
                </View>

                {openCmt === p.id && (
                  <View style={styles.comments}>
                    {p.comments.map((c, ci) => (
                      <View key={ci} style={{ paddingVertical: 7, paddingLeft: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
                          <Pressable onPress={() => goProfile(c.publicId, c.who, c.mine)}>
                            <Portrait name={c.who} size={28} photo={c.mine ? userPhoto || undefined : c.photo} />
                          </Pressable>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Txt size={12} color={C.text} lh={1.4}>
                              <Txt weight="extrabold" size={11.5} color={c.mine ? C.gold2 : C.text} onPress={() => goProfile(c.publicId, c.who, c.mine)}>{c.mine ? userName : c.who} </Txt>
                              {c.text}
                            </Txt>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4 }}>
                              <Pressable onPress={() => { setReplyTo(replyTo && replyTo.pid === p.id && replyTo.ci === ci ? null : { pid: p.id, ci }); setReplyText(""); }}>
                                <Txt weight="bold" size={10.5} color={C.dim2}>Yanıtla</Txt>
                              </Pressable>
                              {(c.mine || p.mine) && (
                                <Pressable onPress={() => delComment(p.id, ci)}>
                                  <Txt weight="bold" size={10.5} color={C.dim2}>Sil</Txt>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        </View>
                        {c.replies.map((r, ri) => (
                          <View key={ri} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 6, paddingLeft: 30 }}>
                            <Pressable onPress={() => goProfile(r.publicId, r.who, r.mine)}>
                              <Portrait name={r.who} size={24} photo={r.mine ? userPhoto || undefined : r.photo} />
                            </Pressable>
                            <Txt size={11.5} color={C.text} style={{ flex: 1 }} lh={1.4}>
                              <Txt weight="extrabold" size={11} color={r.mine ? C.gold2 : C.text} onPress={() => goProfile(r.publicId, r.who, r.mine)}>{r.mine ? userName : r.who} </Txt>
                              {r.text}
                            </Txt>
                            {(r.mine || p.mine) && (
                              <Pressable onPress={() => delReply(p.id, ci, ri)} hitSlop={6}>
                                <Txt weight="bold" size={10} color={C.dim2}>Sil</Txt>
                              </Pressable>
                            )}
                          </View>
                        ))}
                        {replyTo && replyTo.pid === p.id && replyTo.ci === ci && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 7, paddingLeft: 30 }}>
                            <Portrait name="Sen" size={24} photo={userPhoto || undefined} />
                            <TextInput value={replyText} onChangeText={setReplyText} autoFocus placeholder={`${c.who} kişisine yanıt…`} placeholderTextColor={C.dim2} style={styles.replyInput} />
                            <SendBtn disabled={!replyText.trim()} onPress={() => addReply(p.id, ci)} size={30} />
                          </View>
                        )}
                      </View>
                    ))}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 8 }}>
                      <Portrait name="Sen" size={28} photo={userPhoto || undefined} />
                      <TextInput value={cmtText} onChangeText={setCmtText} placeholder="Yorum yaz…" placeholderTextColor={C.dim2} style={styles.cmtInput} />
                      <SendBtn disabled={!cmtText.trim()} onPress={() => addComment(p.id)} size={34} />
                    </View>
                  </View>
                )}
              </View>
            )
          )}
        </ScrollView>

        {toast !== "" && (
          <View style={styles.toast}>
            <Txt weight="bold" size={12} color="#fff">{toast}</Txt>
          </View>
        )}
      </SafeAreaView>

      {/* Post aksiyon menüsü */}
      <Sheet visible={!!menuPost} onClose={() => setMenuPost(null)}>
        {menuPost && (
          <>
            <Pressable onPress={() => { setEditId(menuPost.id); setEditText(menuPost.body); setMenuPost(null); }} style={styles.menuItem}>
              <Icon name="edit" size={16} color={C.text} />
              <Txt weight="bold" size={13} color={C.text} style={{ flex: 1 }}>Düzenle</Txt>
            </Pressable>
            <Pressable onPress={() => togglePin(menuPost.id)} style={styles.menuItem}>
              <Icon name="pin" size={16} color={C.text} />
              <Txt weight="bold" size={13} color={C.text} style={{ flex: 1 }}>{menuPost.pinned ? "Sabitlemeyi kaldır" : "Başa sabitle"}</Txt>
            </Pressable>
            <Pressable onPress={() => { setScopePost(menuPost.id); setMenuPost(null); }} style={styles.menuItem}>
              <Icon path={SCOPE_LABEL[menuPost.scope].ic} size={16} color={C.text} />
              <Txt weight="bold" size={13} color={C.text} style={{ flex: 1 }}>Kimler yanıtlayabilir</Txt>
              <Icon name="chev" size={13} color={C.dim2} />
            </Pressable>
            <Pressable onPress={() => delPost(menuPost.id)} style={styles.menuItem}>
              <Icon name="trash" size={16} color="#FB7185" />
              <Txt weight="bold" size={13} color="#FB7185" style={{ flex: 1 }}>Paylaşımı sil</Txt>
            </Pressable>
          </>
        )}
      </Sheet>

      {/* Kapsam seçici */}
      <Sheet visible={scopePost !== null} onClose={() => setScopePost(null)} contentStyle={{ alignItems: "stretch" }}>
        <Txt weight="displayBold" size={16} color="#fff" align="center">Kimler yanıtlayabilir?</Txt>
        <Txt size={11.5} color={C.dim} align="center" style={{ marginBottom: 16, marginTop: 4 }}>Bu paylaşıma kimlerin yanıt verebileceğini seç</Txt>
        {(() => {
          const cur = posts.find((x) => x.id === scopePost && x.type === "user") as UserPost | undefined;
          const sc = cur?.scope || "herkes";
          return ([{ k: "herkes", t: "Herkes", s: "Tüm kullanıcılar yanıtlayabilir" }, { k: "arkadaslar", t: "Arkadaşların", s: "Sadece arkadaş listendekiler" }] as const).map((o) => {
            const on = sc === o.k;
            return (
              <Pressable key={o.k} onPress={() => scopePost !== null && setScope(scopePost, o.k)} style={[styles.scopeRow, { backgroundColor: on ? C.gold + "14" : "rgba(255,255,255,.04)", borderColor: on ? C.gold + "55" : "rgba(255,255,255,.1)" }]}>
                {on ? (
                  <Gradient colors={["#F5CE6E", "#B45309"]} deg={135} style={styles.scopeIcon}>
                    <Icon path={SCOPE_LABEL[o.k].ic} size={19} color="#241A05" />
                  </Gradient>
                ) : (
                  <View style={[styles.scopeIcon, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                    <Icon path={SCOPE_LABEL[o.k].ic} size={19} color={C.dim} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Txt weight="extrabold" size={13.5} color={on ? C.gold2 : C.text}>{o.t}</Txt>
                  <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>{o.s}</Txt>
                </View>
                {on && <Icon name="check" size={18} sw={3} color={C.gold2} />}
              </Pressable>
            );
          });
        })()}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  bellBadge: { position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, paddingHorizontal: 3.5, borderRadius: 8, backgroundColor: C.red, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: C.bg },
  composerTrigger: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.07)", marginBottom: 6 },
  shareChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, backgroundColor: C.gold + "14", borderWidth: 1, borderColor: C.gold + "33" },
  composer: { paddingTop: 4, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.07)", marginBottom: 6 },
  composerInput: { flex: 1, color: C.text, fontSize: 13.5, fontFamily: "PlusJakartaSans_500Medium", lineHeight: 20, marginTop: 6, minHeight: 44, textAlignVertical: "top" },
  postBlock: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)" },
  sysIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  spotlight: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  editInput: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)", borderRadius: 12, padding: 12, color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium", minHeight: 70, textAlignVertical: "top" },
  roomCard: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: "rgba(124,58,237,.1)", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  roomThumb: { width: 46, height: 46, borderRadius: 13, overflow: "hidden" },
  joinChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, backgroundColor: C.gold + "1F", borderWidth: 1, borderColor: C.gold + "44" },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  comments: { marginTop: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: C.gold + "26" },
  cmtInput: { flex: 1, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, color: C.text, fontSize: 12, fontFamily: "PlusJakartaSans_500Medium" },
  replyInput: { flex: 1, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, color: C.text, fontSize: 11.5, fontFamily: "PlusJakartaSans_500Medium" },
  toast: { position: "absolute", alignSelf: "center", bottom: 104, backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: C.gold + "55", paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 4 },
  scopeRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 14, borderRadius: 15, marginBottom: 10, borderWidth: 1 },
  scopeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
