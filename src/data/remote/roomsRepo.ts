import { type SceneKind } from "@/components/Scene";
import { type Room } from "@/data/seed";
import { requireSupabase } from "@/lib/supabase";
import { getMyProfile } from "@/data/remote/profileRepo";

const SELECT_COLS =
  "id, public_id, ad, aciklama, kategori, kapak_url, herkese_acik, olusturan_id, koltuk_sayisi, aktif_katilimci_sayisi, olusturulma_tarihi";

type OdaRow = {
  id: number;
  public_id: string;
  ad: string;
  aciklama: string | null;
  kategori: string | null;
  kapak_url: string | null;
  herkese_acik: boolean;
  olusturan_id: number | null;
  koltuk_sayisi: number;
  aktif_katilimci_sayisi: number;
  olusturulma_tarihi: string;
};

export const SCENES: SceneKind[] = ["official", "club", "lounge", "night", "fire"];
export function toScene(kategori: string | null): SceneKind {
  return kategori && (SCENES as string[]).includes(kategori) ? (kategori as SceneKind) : "club";
}

/** odalar satırını uygulamanın Room tipine çevirir. */
function mapRoom(r: OdaRow, hostName: string, myId: number | null): Room {
  return {
    id: r.public_id,
    dbId: r.id,
    name: r.ad,
    host: hostName,
    online: r.aktif_katilimci_sayisi,
    mic: 0, // canlı koltuk verisi Faz 4 (presence) ile gelecek
    extra: r.aktif_katilimci_sayisi,
    // "live" sabit true idi; boş oda dahil her oda "Canlı" rozeti alıyordu.
    // İçinde kimse yoksa oda canlı değildir.
    live: r.aktif_katilimci_sayisi > 0,
    scene: toScene(r.kategori),
    locked: !r.herkese_acik,
    owner: myId != null && r.olusturan_id === myId,
    crowd: [],
    photo: r.kapak_url || undefined,
    announce: r.aciklama || undefined,
  };
}

/** olusturan_id → kullanici_adi (profiller view, RLS-bypass) toplu eşleme. */
async function fetchHostNames(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const uniq = [...new Set(ids.filter((x): x is number => x != null))];
  if (uniq.length === 0) return map;
  const sb = requireSupabase();
  const { data } = await sb.from("profiller").select("id, kullanici_adi").in("id", uniq);
  for (const row of (data as { id: number; kullanici_adi: string }[]) ?? []) {
    map.set(row.id, row.kullanici_adi);
  }
  return map;
}

/** Herkese açık odalar (kalabalığa göre sıralı). */
export async function listRooms(limit = 50): Promise<Room[]> {
  const sb = requireSupabase();
  const [{ data, error }, me] = await Promise.all([
    // Not: silinmis filtresi RLS policy'sinde (USING) zaten var; client'ta
    // silinmis kolonuna SELECT yetkisi olmadığından burada filtrelemeyiz.
    sb
      .from("odalar")
      .select(SELECT_COLS)
      .eq("herkese_acik", true)
      .order("aktif_katilimci_sayisi", { ascending: false })
      .order("olusturulma_tarihi", { ascending: false })
      .limit(limit),
    getMyProfile().catch(() => null),
  ]);
  if (error) throw error;
  const rows = (data as OdaRow[]) ?? [];
  const hosts = await fetchHostNames(rows.map((r) => r.olusturan_id).filter((x): x is number => x != null));
  return rows.map((r) => mapRoom(r, hosts.get(r.olusturan_id ?? -1) || "Kullanıcı", me?.id ?? null));
}

/**
 * Kendi oluşturduğum oda (varsa, en yenisi). "myRoom" istemcide kalıcı
 * değildi — her reload'da unutulup tekrar oluşturuluyordu (yinelenen satırlar,
 * eski düzenlemeler ulaşılamaz kalıyordu). Bu, tekrar oluşturmadan önce
 * kontrol edilir (get-or-create) ve açılışta durumu buradan yeniden yükler.
 */
export async function getMyRoom(): Promise<Room | null> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return null;
  const { data, error } = await sb
    .from("odalar")
    .select(SELECT_COLS)
    .eq("olusturan_id", me.id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRoom(data as OdaRow, me.kullanici_adi, me.id) : null;
}

/** 6 haneli benzersiz oda ID'si (çakışmada birkaç kez dener). */
function genRoomId(): string {
  return String(Math.floor(100000 + Math.random() * 899999));
}

export type RoomMessage = { id: number; uid: number | null; name: string; photo?: string; publicId?: string; text: string; time: string; me: boolean };

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/** Oda sohbet mesajları (eskiden yeniye) + yazar adı/fotoğrafı. */
export async function getRoomMessages(odaId: number, limit = 60): Promise<RoomMessage[]> {
  const sb = requireSupabase();
  const [{ data, error }, me] = await Promise.all([
    sb.from("oda_mesajlari").select("id, kullanici_id, icerik, gonderilme_tarihi").eq("oda_id", odaId).order("gonderilme_tarihi", { ascending: true }).limit(limit),
    getMyProfile().catch(() => null),
  ]);
  if (error) throw error;
  const rows = (data as { id: number; kullanici_id: number | null; icerik: string; gonderilme_tarihi: string }[]) ?? [];
  const ids = [...new Set(rows.map((r) => r.kullanici_id).filter((x): x is number => x != null))];
  const names = new Map<number, { kullanici_adi: string; profil_resmi: string | null; public_id: string }>();
  if (ids.length) {
    const { data: profs } = await sb.from("profiller").select("id, public_id, kullanici_adi, profil_resmi").in("id", ids);
    for (const p of (profs as { id: number; public_id: string; kullanici_adi: string; profil_resmi: string | null }[]) ?? []) names.set(p.id, p);
  }
  return rows.map((r) => {
    const prof = r.kullanici_id != null ? names.get(r.kullanici_id) : undefined;
    return {
      id: r.id,
      uid: r.kullanici_id,
      name: prof?.kullanici_adi || "Kullanıcı",
      photo: prof?.profil_resmi || undefined,
      publicId: prof?.public_id,
      text: r.icerik,
      time: hhmm(r.gonderilme_tarihi),
      me: me != null && r.kullanici_id === me.id,
    };
  });
}

/** Odaya mesaj gönder (kendi adına). */
export async function sendRoomMessage(odaId: number, text: string): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from("oda_mesajlari").insert({ oda_id: odaId, kullanici_id: me.id, icerik: text.trim() });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Oda üyeliği + roller (021_oda_uyeleri.sql)
// ---------------------------------------------------------------------------

export type RoomRole = "sahip" | "yardimci" | "uye";

export type RoomMember = {
  id: number;
  publicId: string;
  name: string;
  photo?: string;
  rol: RoomRole;
  katilma: string;
};

/** Oda üyeleri (rol sırasına göre: sahip → yardımcı → üye) + benim rolüm. */
export async function getRoomMembers(odaId: number): Promise<{ members: RoomMember[]; myRole: RoomRole | null }> {
  const sb = requireSupabase();
  const [{ data, error }, me] = await Promise.all([
    sb.from("oda_uyeleri").select("kullanici_id, rol, katilma_tarihi").eq("oda_id", odaId),
    getMyProfile().catch(() => null),
  ]);
  if (error) throw error;
  const rows = (data as { kullanici_id: number; rol: RoomRole; katilma_tarihi: string }[]) ?? [];
  const ids = rows.map((r) => r.kullanici_id);
  const profs = new Map<number, { public_id: string; kullanici_adi: string; profil_resmi: string | null }>();
  if (ids.length) {
    const { data: ps } = await sb.from("profiller").select("id, public_id, kullanici_adi, profil_resmi").in("id", ids);
    for (const p of (ps as { id: number; public_id: string; kullanici_adi: string; profil_resmi: string | null }[]) ?? []) profs.set(p.id, p);
  }
  const order: Record<RoomRole, number> = { sahip: 0, yardimci: 1, uye: 2 };
  const members = rows
    .map((r) => {
      const p = profs.get(r.kullanici_id);
      return {
        id: r.kullanici_id,
        publicId: p?.public_id || "",
        name: p?.kullanici_adi || "Kullanıcı",
        photo: p?.profil_resmi || undefined,
        rol: r.rol,
        katilma: r.katilma_tarihi,
      };
    })
    .sort((a, b) => order[a.rol] - order[b.rol] || a.katilma.localeCompare(b.katilma));
  const myRole = me ? (rows.find((r) => r.kullanici_id === me.id)?.rol ?? null) : null;
  return { members, myRole };
}

/** Üye olduğum odaların dbId listesi — ana sayfadaki "Katıldıklarım" sekmesi. */
export async function getMyRoomIds(): Promise<number[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];
  const { data, error } = await sb.from("oda_uyeleri").select("oda_id").eq("kullanici_id", me.id);
  if (error) throw error;
  return ((data as { oda_id: number }[]) ?? []).map((r) => r.oda_id);
}

/**
 * Bir kullanıcının üye olduğu oda sayısı — profildeki "Katıldığı Odalar".
 * oda_uyeleri SELECT politikası herkese açık (021), ayrı bir RPC gerekmiyor.
 */
export async function getUserRoomCount(userId: number): Promise<number> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("oda_uyeleri")
    .select("oda_id", { count: "exact", head: true })
    .eq("kullanici_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/** Odaya üye ol (kendi adına, 'uye'). Zaten üyeyse sessizce geçer. */
export async function joinRoomMembership(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from("oda_uyeleri").insert({ oda_id: odaId, kullanici_id: me.id, rol: "uye" });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

/** Oda üyeliğinden ayrıl (sahip ayrılamaz — RLS engeller). */
export async function leaveRoomMembership(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return;
  const { error } = await sb.from("oda_uyeleri").delete().eq("oda_id", odaId).eq("kullanici_id", me.id);
  if (error) throw error;
}

/** Üyeye rol ata ('yardimci' | 'uye') — yalnızca sahip/platform yöneticisi. */
export async function setRoomMemberRole(odaId: number, userId: number, rol: "yardimci" | "uye"): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_rol_ata", { p_oda_id: odaId, p_hedef: userId, p_rol: rol });
  if (error) throw error;
}

/** Üyeyi odadan çıkar — sahip herkesi, yardımcı yalnızca üyeyi. */
export async function removeRoomMember(odaId: number, userId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_uye_cikar", { p_oda_id: odaId, p_hedef: userId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Oda yasakları (022_oda_yasaklari.sql)
// ---------------------------------------------------------------------------

export type RoomBan = {
  id: number;
  publicId: string;
  name: string;
  photo?: string;
  by: string;
  at: number; // epoch ms
};

/** Kullanıcıyı odadan yasakla (üyeliği de düşer). Yetki sunucuda doğrulanır. */
export async function banRoomUser(odaId: number, userId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_yasakla", { p_oda_id: odaId, p_hedef: userId });
  if (error) throw error;
}

/** Yasağı kaldır — kullanıcı tekrar üye olabilir. */
export async function unbanRoomUser(odaId: number, userId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_yasak_kaldir", { p_oda_id: odaId, p_hedef: userId });
  if (error) throw error;
}

/** public_id ile yasakla (koltuk/kart akışları hedefi publicId ile tanır). */
export async function banRoomUserByPublicId(odaId: number, publicId: string): Promise<void> {
  const sb = requireSupabase();
  const { data } = await sb.from("profiller").select("id").eq("public_id", publicId).maybeSingle();
  const id = (data as { id: number } | null)?.id;
  if (id == null) throw new Error("Kullanıcı bulunamadı.");
  await banRoomUser(odaId, id);
}

/** Odanın yasaklı listesi (yeniden eskiye) — kim, kim tarafından, ne zaman. */
export async function listRoomBans(odaId: number): Promise<RoomBan[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("oda_yasaklari")
    .select("kullanici_id, yasaklayan_id, yasaklanma_tarihi")
    .eq("oda_id", odaId)
    .order("yasaklanma_tarihi", { ascending: false });
  if (error) throw error;
  const rows = (data as { kullanici_id: number; yasaklayan_id: number | null; yasaklanma_tarihi: string }[]) ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.kullanici_id, r.yasaklayan_id]).filter((x): x is number => x != null))];
  const profs = new Map<number, { public_id: string; kullanici_adi: string; profil_resmi: string | null }>();
  if (ids.length) {
    const { data: ps } = await sb.from("profiller").select("id, public_id, kullanici_adi, profil_resmi").in("id", ids);
    for (const p of (ps as { id: number; public_id: string; kullanici_adi: string; profil_resmi: string | null }[]) ?? []) profs.set(p.id, p);
  }
  return rows.map((r) => {
    const p = profs.get(r.kullanici_id);
    return {
      id: r.kullanici_id,
      publicId: p?.public_id || "",
      name: p?.kullanici_adi || "Kullanıcı",
      photo: p?.profil_resmi || undefined,
      by: (r.yasaklayan_id != null ? profs.get(r.yasaklayan_id)?.kullanici_adi : undefined) || "Yönetici",
      at: new Date(r.yasaklanma_tarihi).getTime(),
    };
  });
}

// ---------------------------------------------------------------------------
// Platform mic-yasağı (028_mic_yasak.sql)
// ---------------------------------------------------------------------------

export type MicBan = { sebep: string | null; bitis: number | null; kalici: boolean };

/** Kendi aktif mic-yasağım (yoksa null). bitis: epoch ms | null (kalıcı). */
export async function getMyMicBan(): Promise<MicBan | null> {
  const sb = requireSupabase();
  const { data } = await sb.rpc("benim_mic_yasagim");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    sebep: row.sebep ?? null,
    bitis: row.bitis ? new Date(row.bitis).getTime() : null,
    kalici: !!row.kalici,
  };
}

/** Bu odadan yasaklı mıyım? (odaya girişte kontrol) */
export async function amIBannedFromRoom(odaId: number): Promise<boolean> {
  const sb = requireSupabase();
  const me = await getMyProfile().catch(() => null);
  if (!me) return false;
  const { data } = await sb
    .from("oda_yasaklari")
    .select("kullanici_id")
    .eq("oda_id", odaId)
    .eq("kullanici_id", me.id)
    .maybeSingle();
  return data != null;
}

// ---------------------------------------------------------------------------
// Oda giriş/çıkış kaydı + yönetici rapor detayı (032_oda_hareket.sql)
// ---------------------------------------------------------------------------

/** Odaya giriş/çıkış kaydı (kendi adına, best-effort). Hata sessizce yutulur. */
export async function logRoomMovement(odaId: number, tip: "giris" | "cikis"): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile().catch(() => null);
  if (!me) return;
  await sb.from("oda_hareket_log").insert({ oda_id: odaId, kullanici_id: me.id, tip }).then(
    () => {},
    () => {},
  );
}

export type RoomMovement = {
  id: number;
  uid: number;
  name: string;
  photo?: string;
  publicId?: string;
  tip: "giris" | "cikis";
  at: number; // epoch ms
};

export type RoomReportDetail = {
  oda: {
    id: number;
    publicId: string;
    name: string;
    aciklama: string | null;
    kategori: string | null;
    photo?: string;
    hostName: string;
    uyeSayisi: number;
    aktifKatilimci: number;
  } | null;
  hareketler: RoomMovement[];
  girenSayisi: number; // benzersiz giren kullanıcı
  cikanSayisi: number; // benzersiz çıkan kullanıcı
};

/** Yönetici: oda bilgisi + giriş/çıkış geçmişi (SELECT yalnızca platform yöneticisi — RLS). */
export async function getRoomReportDetail(odaId: number, limit = 200): Promise<RoomReportDetail> {
  const sb = requireSupabase();
  const [odaRes, hareketRes, uyeRes] = await Promise.all([
    sb.from("odalar").select(SELECT_COLS).eq("id", odaId).maybeSingle(),
    sb.from("oda_hareket_log").select("id, kullanici_id, tip, tarih").eq("oda_id", odaId).order("id", { ascending: false }).limit(limit),
    sb.from("oda_uyeleri").select("kullanici_id", { count: "exact", head: true }).eq("oda_id", odaId),
  ]);

  const oRow = odaRes.data as OdaRow | null;
  const uyeSayisi = uyeRes.count ?? 0;
  const hRows = (hareketRes.data as { id: number; kullanici_id: number; tip: "giris" | "cikis"; tarih: string }[]) ?? [];

  // profil eşleme (oda sahibi + hareket kullanıcıları)
  const ids = [...new Set([...(oRow?.olusturan_id != null ? [oRow.olusturan_id] : []), ...hRows.map((h) => h.kullanici_id)])];
  const profs = new Map<number, { public_id: string; kullanici_adi: string; profil_resmi: string | null }>();
  if (ids.length) {
    const { data: ps } = await sb.from("profiller").select("id, public_id, kullanici_adi, profil_resmi").in("id", ids);
    for (const p of (ps as { id: number; public_id: string; kullanici_adi: string; profil_resmi: string | null }[]) ?? []) profs.set(p.id, p);
  }

  const hareketler: RoomMovement[] = hRows.map((h) => {
    const p = profs.get(h.kullanici_id);
    return {
      id: h.id,
      uid: h.kullanici_id,
      name: p?.kullanici_adi || "Kullanıcı",
      photo: p?.profil_resmi || undefined,
      publicId: p?.public_id,
      tip: h.tip,
      at: new Date(h.tarih).getTime(),
    };
  });

  const girenSayisi = new Set(hRows.filter((h) => h.tip === "giris").map((h) => h.kullanici_id)).size;
  const cikanSayisi = new Set(hRows.filter((h) => h.tip === "cikis").map((h) => h.kullanici_id)).size;

  return {
    oda: oRow
      ? {
          id: oRow.id,
          publicId: oRow.public_id,
          name: oRow.ad,
          aciklama: oRow.aciklama,
          kategori: oRow.kategori,
          photo: oRow.kapak_url || undefined,
          hostName: (oRow.olusturan_id != null ? profs.get(oRow.olusturan_id)?.kullanici_adi : undefined) || "Kullanıcı",
          uyeSayisi,
          aktifKatilimci: oRow.aktif_katilimci_sayisi,
        }
      : null,
    hareketler,
    girenSayisi,
    cikanSayisi,
  };
}

// ---------------------------------------------------------------------------
// Oda ayarları (sahip) — tema/kapak/isim/duyuru + parola (039_oda_ayar.sql)
// ---------------------------------------------------------------------------

/** Sahip: oda ayarlarını güncelle (RLS sahibi doğrular). herkese_acik'a dokunmaz. */
export async function updateRoomSettings(
  odaId: number,
  patch: { ad?: string; aciklama?: string | null; kategori?: string; kapak_url?: string | null },
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("odalar").update(patch).eq("id", odaId);
  if (error) throw error;
}

/** Sahip: oda parolası belirle (kilitler) ya da null → kaldırır (açar). */
export async function setRoomPassword(odaId: number, parola: string | null): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_parola_belirle", { p_oda: odaId, p_parola: parola });
  if (error) throw error;
}

/** Giriş kapısı: parolayı doğrula (sifre_hash gizli; RPC boolean döner). */
export async function verifyRoomPassword(odaId: number, parola: string): Promise<boolean> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("oda_parola_dogrula", { p_oda: odaId, p_parola: parola });
  if (error) throw error;
  return !!data;
}

/** Yeni oda oluştur (kendi adına). Oluşan Room'u döndürür. */
export async function createRoom(input: {
  name: string;
  photo?: string | null;
  aciklama?: string | null;
  kategori?: string | null;
}): Promise<Room> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await sb
      .from("odalar")
      .insert({
        public_id: genRoomId(),
        ad: input.name.trim(),
        aciklama: input.aciklama ?? null,
        kategori: input.kategori ?? "club",
        kapak_url: input.photo ?? null,
        herkese_acik: true,
        olusturan_id: me.id,
        koltuk_sayisi: 8,
      })
      .select(SELECT_COLS)
      .single();
    if (!error && data) {
      return mapRoom(data as OdaRow, me.kullanici_adi, me.id);
    }
    // 23505 = unique_violation (public_id çakışması) → yeni ID ile tekrar dene
    if ((error as { code?: string } | null)?.code === "23505") { lastErr = error; continue; }
    throw error;
  }
  throw lastErr ?? new Error("Oda oluşturulamadı.");
}
