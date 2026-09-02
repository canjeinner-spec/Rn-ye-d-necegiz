import { type SceneKind } from "@/components/Scene";
import { type RoomBadgeItem } from "@/components/RoomBadges";
import { type Room } from "@/data/seed";
import { benzersizKanalAdi, requireSupabase, supabase } from "@/lib/supabase";
import { getMyProfile } from "@/data/remote/profileRepo";

const TEMEL_COLS =
  "id, public_id, ad, aciklama, kategori, kapak_url, herkese_acik, olusturan_id, koltuk_sayisi, aktif_katilimci_sayisi, olusturulma_tarihi";

// 052_oda_vitrin.sql ile gelen kolonlar. Migration uygulanmamış bir projede
// bunları istemek 42703 döndürür ve TÜM oda listesi çöker — bu yüzden
// istekler once/sonra kalıbıyla korunuyor (aşağıdaki odalariGetir).
const VITRIN_COLS = "resmi, gunluk_sira, islem_gordu, islem_sebep";
const SELECT_COLS = `${TEMEL_COLS}, ${VITRIN_COLS}`;

/** Kolon yok hatası mı? (PostgREST → undefined column) */
function kolonYok(e: unknown) {
  return (e as { code?: string })?.code === "42703";
}

/**
 * Tablo/fonksiyon yok hatası mı?
 *
 * 055 (oda_takip, oda_ziyaretleri) Supabase'de çalıştırılmamışsa Odam ekranı
 * çökmesin, sekmeler boş görünsün diye. Aynı ders daha önce alınmıştı:
 * uygulanmamış migration'a bağlanan SELECT tüm profil okumalarını çökertmişti.
 */
function tabloYok(e: unknown) {
  const c = (e as { code?: string })?.code;
  return c === "42P01" || c === "42883" || c === "PGRST202" || c === "PGRST205";
}

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
  resmi?: boolean;
  gunluk_sira?: number | null;
  islem_gordu?: boolean;
  islem_sebep?: string | null;
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
    ownerId: r.olusturan_id ?? undefined,
    crowd: [],
    photo: r.kapak_url || undefined,
    announce: r.aciklama || undefined,
    // "Yeni" sekmesi kuruluş tarihine göre sıralıyor.
    createdAt: Date.parse(r.olusturulma_tarihi) || undefined,
    // 052: resmî oda rozeti ve Daily Top sırası. Önceden hiç okunmuyordu,
    // bu yüzden gerçek odalar asla resmî olamıyor/sıraya giremiyordu.
    official: r.resmi || undefined,
    daily: r.gunluk_sira ?? undefined,
    islemGordu: r.islem_gordu || undefined,
    islemSebep: r.islem_sebep ?? undefined,
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

/**
 * odalar sorgusu — vitrin kolonlarıyla dener, kolonlar yoksa (052 henüz
 * uygulanmamışsa) temel kolonlarla tekrar dener.
 *
 * Daha önce client'ı uygulanmamış bir migration'a bağlamak tüm profil
 * okumalarını çökertmişti; aynı hatayı oda listesinde tekrarlamamak için.
 */
async function odalariGetir<T>(
  kur: (cols: string) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T> {
  const ilk = await kur(SELECT_COLS);
  if (!ilk.error) return ilk.data as T;
  if (!kolonYok(ilk.error)) throw ilk.error;
  console.warn("[odalar] vitrin kolonlari yok (052 uygulanmamis) — temel kolonlara dusuluyor");
  const geri = await kur(TEMEL_COLS);
  if (geri.error) throw geri.error;
  return geri.data as T;
}

/** Herkese açık odalar (kalabalığa göre sıralı). */
export async function listRooms(limit = 50): Promise<Room[]> {
  const sb = requireSupabase();
  const [data, me] = await Promise.all([
    // Not: silinmis filtresi RLS policy'sinde (USING) zaten var; client'ta
    // silinmis kolonuna SELECT yetkisi olmadığından burada filtrelemeyiz.
    odalariGetir<OdaRow[] | null>((cols) =>
      sb
        .from("odalar")
        .select(cols)
        .eq("herkese_acik", true)
        .order("aktif_katilimci_sayisi", { ascending: false })
        .order("olusturulma_tarihi", { ascending: false })
        .limit(limit),
    ),
    getMyProfile().catch(() => null),
  ]);
  const rows = data ?? [];
  // TEŞHİS: burada basılan sayı DB SAYACIDIR (istatistik), listenin görünürlük
  // ölçütü DEĞİL — o `oda_katilimcilar` tablosundan geliyor (070).
  // Etiketi karışmasın diye açıkça "sayac" yazıyor: eski oturumlarda bu satır
  // presence sanılıp yanlış iz sürüldü.
  console.log(`[liste] db=${rows.length} oda; sayac: ${rows.map((r) => `${r.id}:${r.aktif_katilimci_sayisi ?? 0}`).join(" ")}`);
  const hosts = await fetchHostNames(rows.map((r) => r.olusturan_id).filter((x): x is number => x != null));
  // Rozetler (066): listede görünen odalar için tek çağrıda.
  return rozetleriBagla(rows.map((r) => mapRoom(r, hosts.get(r.olusturan_id ?? -1) || "Kullanıcı", me?.id ?? null)));
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
  const data = await odalariGetir<OdaRow | null>((cols) =>
    sb
      .from("odalar")
      .select(cols)
      .eq("olusturan_id", me.id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (!data) return null;
  // Rozetler burada da bağlanmalı: profildeki "Odam" bu fonksiyondan besleniyor
  // ve rozetsiz geldiği için kendi odana oradan girince rozetler yoktu,
  // "Son günlerde"den girince vardı (o yol odalariIdIleGetir'den geçiyor).
  const [oda] = await rozetleriBagla([mapRoom(data, me.kullanici_adi, me.id)]);
  return oda ?? null;
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
  // SON limit mesaj isteniyor: yeniden eskiye çekilip ters çevriliyor.
  // (ascending:true + limit, EN ESKİ limit mesajı getirirdi — kalabalık
  // odada geçmiş hep aynı ilk mesajlarda takılı kalırdı.)
  const [{ data, error }, me] = await Promise.all([
    sb.from("oda_mesajlari").select("id, kullanici_id, icerik, gonderilme_tarihi").eq("oda_id", odaId).order("gonderilme_tarihi", { ascending: false }).limit(limit),
    getMyProfile().catch(() => null),
  ]);
  if (error) throw error;
  const rows = ((data as { id: number; kullanici_id: number | null; icerik: string; gonderilme_tarihi: string }[]) ?? []).reverse();
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

/**
 * Odaya mesaj gönder — kalıcılık katmanı (078).
 *
 * Anlık yol broadcast'te kalıyor; bu yalnız `oda_mesajlari`na yazar.
 * Doğrudan INSERT grant'i 078'de kapandı: yazma tek yol, RPC. Mikrofon
 * yasağı/oda yasağı sunucuda kontrol ediliyor.
 */
export async function sendRoomMessage(odaId: number, text: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_mesaj_yaz", { p_oda: odaId, p_icerik: text.trim() });
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

/**
 * Yasaklandığım odaların dbId listesi. Bu odalar oda listesinde hiç
 * görünmemeli — girilemeyecek bir odayı listelemek anlamsız.
 */
export async function getMyBannedRoomIds(): Promise<number[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];
  const { data, error } = await sb.from("oda_yasaklari").select("oda_id").eq("kullanici_id", me.id);
  if (error) throw error;
  return ((data as { oda_id: number }[]) ?? []).map((r) => r.oda_id);
}

/** Üye olduğum odaların dbId listesi. */
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

// ---------------------------------------------------------------------------
// Odam ekranı — "Son günlerde" / "Katıl" / "Takip et"
//
// Üç sekme de ROOMS (data/seed.ts) sabitinin dilimlerini gösteriyordu. Artık
// üçü de üç ayrı gerçek kaynaktan okunuyor: oda_ziyaretleri, oda_uyeleri,
// oda_takip. 055 uygulanmamışsa liste boş döner, ekran çalışmaya devam eder.
// ---------------------------------------------------------------------------

/** dbId listesini Room'a çevirir; dönen dizi ids'teki SIRAYI korur. */
async function odalariIdIleGetir(ids: number[]): Promise<Room[]> {
  if (ids.length === 0) return [];
  const sb = requireSupabase();
  const [data, me] = await Promise.all([
    odalariGetir<OdaRow[] | null>((cols) => sb.from("odalar").select(cols).in("id", ids)),
    getMyProfile().catch(() => null),
  ]);
  const rows = data ?? [];
  const hosts = await fetchHostNames(rows.map((r) => r.olusturan_id).filter((x): x is number => x != null));
  const bul = new Map<number, Room>();
  for (const r of rows) {
    bul.set(r.id, mapRoom(r, hosts.get(r.olusturan_id ?? -1) || "Kullanıcı", me?.id ?? null));
  }
  // Silinmiş/gizlenmiş odalar RLS yüzünden gelmez; sessizce listeden düşerler.
  // Rozetler burada da bağlanıyor: Odam sekmeleri bu yoldan geçiyor ve
  // rozetsiz geldikleri için oda kartında/çipinde hiç görünmüyorlardı.
  return rozetleriBagla(ids.map((id) => bul.get(id)).filter((r): r is Room => !!r));
}

/**
 * Odaya girişi ziyaret geçmişine yazar (oda başına tek satır, sayaç artar).
 * Best-effort: hata olursa odaya giriş engellenmemeli.
 */
export async function ziyaretKaydet(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_ziyaret_kaydet", { p_oda_id: odaId });
  if (error && !tabloYok(error)) throw error;
}

/** Odam listelerinde kullanılan oda + (varsa) son ziyaret zamanı. */
export type OdamOdasi = Room & { sonZiyaret?: number };

/** "Son günlerde" — son ziyaret ettiğim odalar, en yeniden eskiye. */
export async function sonZiyaretEdilenOdalar(limit = 20): Promise<OdamOdasi[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];
  const { data, error } = await sb
    .from("oda_ziyaretleri")
    .select("oda_id, son_giris")
    .eq("kullanici_id", me.id)
    .order("son_giris", { ascending: false })
    .limit(limit);
  if (error) {
    if (tabloYok(error)) return [];
    throw error;
  }
  const satirlar = (data as { oda_id: number; son_giris: string }[]) ?? [];
  const zaman = new Map(satirlar.map((r) => [r.oda_id, Date.parse(r.son_giris)]));
  const odalar = await odalariIdIleGetir(satirlar.map((r) => r.oda_id));
  return odalar.map((o) => ({ ...o, sonZiyaret: o.dbId != null ? zaman.get(o.dbId) : undefined }));
}

/** "Katıl" — üye olduğum odalar (oda_uyeleri, en son katıldığım üstte). */
export async function katildigimOdalar(limit = 50): Promise<Room[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];
  const { data, error } = await sb
    .from("oda_uyeleri")
    .select("oda_id, katilma_tarihi")
    .eq("kullanici_id", me.id)
    .order("katilma_tarihi", { ascending: false })
    .limit(limit);
  if (error) {
    if (tabloYok(error)) return [];
    throw error;
  }
  return odalariIdIleGetir(((data as { oda_id: number }[]) ?? []).map((r) => r.oda_id));
}

/** "Takip et" — takip ettiğim odalar. */
export async function takipEttigimOdalar(limit = 50): Promise<Room[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];
  const { data, error } = await sb
    .from("oda_takip")
    .select("oda_id, tarih")
    .eq("kullanici_id", me.id)
    .order("tarih", { ascending: false })
    .limit(limit);
  if (error) {
    if (tabloYok(error)) return [];
    throw error;
  }
  return odalariIdIleGetir(((data as { oda_id: number }[]) ?? []).map((r) => r.oda_id));
}

/** Bu odayı takip ediyor muyum? (055 yoksa: hayır) */
export async function odaTakiptenMi(odaId: number): Promise<boolean> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return false;
  const { count, error } = await sb
    .from("oda_takip")
    .select("oda_id", { count: "exact", head: true })
    .eq("kullanici_id", me.id)
    .eq("oda_id", odaId);
  if (error) {
    if (tabloYok(error)) return false;
    throw error;
  }
  return (count ?? 0) > 0;
}

/** Odayı takip et. Zaten takiptesen sessizce geçer. */
export async function odaTakipEt(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from("oda_takip").insert({ kullanici_id: me.id, oda_id: odaId });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

/** Oda takibini bırak. */
export async function odaTakiptenCik(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return;
  const { error } = await sb.from("oda_takip").delete().eq("kullanici_id", me.id).eq("oda_id", odaId);
  if (error) throw error;
}

/**
 * Odadaki kişi sayısını yaz (057).
 *
 * `aktif_katilimci_sayisi` hiç yazılmıyordu: kolon 0 kalıyor, oda listesi de
 * "boş odaları gösterme" kuralını buna bakarak uyguladığı için yeni kurulan
 * odalar hiçbir sekmede görünmüyordu. Odadaki istemcilerden biri (en küçük
 * uid) presence'taki gerçek sayıyı buraya yazar.
 */
export async function odaKatilimciYaz(odaId: number, sayi: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_katilimci_yaz", { p_oda_id: odaId, p_sayi: sayi });
  if (error && !tabloYok(error)) throw error;
}

/** Oda sahibinin güncel profili — host koltuğu presence'a bağlı kalmasın. */
export type OdaSahibi = { id: number; ad: string; foto?: string; publicId?: string };

/**
 * Odanın sahibini DB'den okur.
 *
 * Host koltuğu daha önce presence'taki ADA göre eşleştiriliyordu; ad
 * lookup'ı "Kullanıcı"ya düşünce ya da sahip adını değiştirince tutmuyor,
 * koltuk boş silüet kalıyordu. Artık sahip kim olduğu DB'den kesin biliniyor;
 * presence yalnızca "şu an odada mı" bilgisini veriyor.
 */
export async function odaSahibi(odaId: number): Promise<OdaSahibi | null> {
  const sb = requireSupabase();
  const { data: oda, error } = await sb.from("odalar").select("olusturan_id").eq("id", odaId).maybeSingle();
  if (error || !oda) return null;
  const sahipId = (oda as { olusturan_id: number | null }).olusturan_id;
  if (sahipId == null) return null;

  const { data: p } = await sb
    .from("profiller")
    .select("id, kullanici_adi, profil_resmi, public_id")
    .eq("id", sahipId)
    .maybeSingle();
  const pr = p as { id: number; kullanici_adi: string; profil_resmi: string | null; public_id: string } | null;
  if (!pr) return { id: sahipId, ad: "Kullanıcı" };
  return { id: pr.id, ad: pr.kullanici_adi, foto: pr.profil_resmi || undefined, publicId: pr.public_id };
}

/**
 * Oda listesini CANLI dinle (065).
 *
 * Liste eskiden yalnızca ekran odaklandığında yeniden çekiliyordu; yeni açılan
 * oda 15-20 saniye sonra, sekme değiştirip dönünce "birden" beliriyordu.
 * Artık `odalar` tablosundaki her değişiklik (yeni oda, katılımcı sayısı, ad,
 * kapak, işlem işareti, silme) anında düşüyor.
 *
 * Olaylar salkım hâlinde gelir — oda açılırken INSERT'i hemen bir sayaç
 * UPDATE'i izler. Her biri için ayrı sorgu atmayalım diye 400 ms'lik bir
 * bekleme var: son olaydan 400 ms sonra tek sorgu.
 *
 * Realtime postgres_changes RLS'i uygular; kullanıcı yalnızca zaten
 * görebildiği odaların değişimini alır.
 */
export function odaDegisiklikleriniDinle(geriCagir: () => void): () => void {
  const sb = supabase;
  if (!sb) return () => {};

  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  const tetikle = () => {
    if (zamanlayici) clearTimeout(zamanlayici);
    zamanlayici = setTimeout(geriCagir, 400);
  };

  const ch = sb
    .channel(benzersizKanalAdi("odalar-degisim"))
    .on("postgres_changes", { event: "*", schema: "public", table: "odalar" }, tetikle)
    .subscribe();

  return () => {
    if (zamanlayici) clearTimeout(zamanlayici);
    sb.removeChannel(ch);
  };
}

/**
 * Oda rozetleri (066) — kuralla kazanılanlar + elle verilenler tek listede.
 *
 * Kuralla kazanılanlar tabloda durmuyor, okuma anında hesaplanıyor: "haftalık
 * şampiyon" dün doğruysa bugün başka odanın olabilir, anlık görüntü tutmak
 * yanlış olurdu (060'taki sıralamayla aynı gerekçe).
 */
/** Rozetleri odalara bağla — hem liste hem Odam aynı yoldan geçsin. */
async function rozetleriBagla(odalar: Room[]): Promise<Room[]> {
  const ids = odalar.map((o) => o.dbId).filter((x): x is number => x != null);
  if (ids.length === 0) return odalar;
  const harita = await odaRozetleri(ids).catch(() => new Map<number, RoomBadgeItem[]>());
  return odalar.map((o) => {
    const rz = o.dbId != null ? harita.get(o.dbId) : undefined;
    return rz && rz.length > 0 ? { ...o, badges: rz } : o;
  });
}

export async function odaRozetleri(odaIds: number[]): Promise<Map<number, RoomBadgeItem[]>> {
  const harita = new Map<number, RoomBadgeItem[]>();
  if (odaIds.length === 0) return harita;
  const sb = supabase;
  if (!sb) return harita;

  const { data, error } = await sb.rpc("oda_rozetleri_getir", { p_oda_ids: odaIds });
  if (error) {
    // Sessizce boş dönmek "rozet yok" ile "sorgu patladı"yı aynı gösteriyordu.
    console.warn("[rozet]", error.code, error.message);
    return harita;
  }
  for (const r of (data as { oda_id: number; kod: string; deger: number | null }[]) ?? []) {
    const liste = harita.get(r.oda_id) ?? [];
    liste.push({ type: r.kod as RoomBadgeItem["type"], n: r.deger ?? undefined });
    harita.set(r.oda_id, liste);
  }
  return harita;
}

/** Rozet kataloğu — yönetim ekranında "hangi rozeti verebilirim" listesi. */
export type RozetKatalogu = { kod: string; ad: string; aciklama: string; kaynak: "kural" | "elle" };
export async function rozetKatalogu(): Promise<RozetKatalogu[]> {
  const sb = supabase;
  if (!sb) return [];
  const { data, error } = await sb
    .from("oda_rozet_katalogu")
    .select("kod, ad, aciklama, kaynak, sira")
    .eq("aktif", true)
    .order("sira", { ascending: true });
  if (error) return [];
  return ((data as RozetKatalogu[]) ?? []);
}

/** Odaya elle rozet ver (yalnız platform yöneticisi). `gun` yoksa süresiz. */
export async function odaRozetVer(odaId: number, kod: string, gun?: number, sebep?: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_oda_rozet_ver", {
    p_oda_id: odaId, p_kod: kod, p_gun: gun ?? null, p_sebep: sebep ?? null,
  });
  if (error) throw error;
}

export async function odaRozetAl(odaId: number, kod: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_oda_rozet_al", { p_oda_id: odaId, p_kod: kod });
  if (error) throw error;
}

/** Bir odanın elle verilmiş rozetleri (yönetim ekranı). */
export async function odaVerilenRozetler(odaId: number): Promise<{ kod: string; ad: string; sebep: string | null; bitis: number | null }[]> {
  const sb = supabase;
  if (!sb) return [];
  const { data, error } = await sb.rpc("admin_oda_rozet_listesi", { p_oda_id: odaId });
  if (error) return [];
  return ((data as { kod: string; ad: string; sebep: string | null; bitis: string | null }[]) ?? []).map((r) => ({
    kod: r.kod, ad: r.ad, sebep: r.sebep, bitis: r.bitis ? Date.parse(r.bitis) : null,
  }));
}

// ---------------------------------------------------------------------------
// KOLTUKLAR (068) — kim nerede oturuyor, mikrofonu açık mı, hangi koltuk kilitli
//
// Bu bilgi eskiden Realtime PRESENCE ile taşınıyordu ve üç oturum boyunca
// kararlı çalışmadı: bir presence anahtarında birden çok kayıt olabiliyor,
// sırası garanti değil, arkaplanda kayıt asılı kalıyordu. Kullanıcının ölçtüğü
// tek kararlı yol `postgres_changes` (oda listesi onunla anlık çalışıyor),
// bu yüzden koltuk durumu artık gerçek bir tabloda.
// ---------------------------------------------------------------------------

/**
 * KOLTUK NUMARASI EŞLEMESİ — uygulama ile veritabanı aynı sayıları kullanmıyor.
 *
 * `oda_koltuklari` TEMEL ŞEMADAN geliyor ve orada:
 *   • koltuklar 1'DEN başlıyor (CHECK: koltuk_no BETWEEN 1 AND 20)
 *   • 0 ve negatif değer YASAK, yani oda sahibi için -1 kullanılamıyor
 * Uygulama tarafı ise 0..7 indeksli ve sahibin koltuğu -1. Dönüşüm burada,
 * tek yerde yapılıyor; ekran kodu kendi sayılarıyla çalışmaya devam ediyor.
 *
 * Sahne başı için 20 seçildi: CHECK'in üst sınırı ve trigger'ın açtığı
 * 1..koltuk_sayisi aralığına (pratikte 1..8) hiç girmiyor.
 */
const SAHIP_KOLTUK_NO = 20;
const istemcidenDbye = (i: number) => (i < 0 ? SAHIP_KOLTUK_NO : i + 1);
const dbdenIstemciye = (no: number) => (no === SAHIP_KOLTUK_NO ? -1 : no - 1);

export type KoltukSatiri = {
  /** -1 = oda sahibinin koltuğu, 0..7 = normal koltuklar (İSTEMCİ numarası) */
  koltukNo: number;
  kullaniciId: number | null;
  micAcik: boolean;
  kilitli: boolean;
  ad: string | null;
  foto: string | null;
  publicId: string | null;
  yetkili: boolean;
};

type KoltukRow = {
  koltuk_no: number;
  kullanici_id: number | null;
  /** DB'de mantık TERS tutuluyor: susturulmus = mikrofon kapalı. */
  susturulmus: boolean;
  kilitli: boolean;
  kullanici_adi: string | null;
  profil_resmi: string | null;
  public_id: string | null;
  yetkili: boolean;
};

/** Odanın koltuk tablosu — isim/foto ile birlikte tek çağrıda. */
export async function koltuklariGetir(odaId: number): Promise<KoltukSatiri[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("oda_koltuklari_getir", { p_oda: odaId });
  if (error) {
    // 068 henüz çalıştırılmadıysa ekran çalışmaya devam etsin (boş koltuklar).
    if (tabloYok(error)) return [];
    throw error;
  }
  return ((data as KoltukRow[]) ?? []).map((r) => ({
    koltukNo: dbdenIstemciye(Number(r.koltuk_no)),
    kullaniciId: r.kullanici_id == null ? null : Number(r.kullanici_id),
    micAcik: !r.susturulmus,
    kilitli: !!r.kilitli,
    ad: r.kullanici_adi,
    foto: r.profil_resmi,
    publicId: r.public_id,
    yetkili: !!r.yetkili,
  }));
}

export async function koltugaOtur(odaId: number, koltuk: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("koltuga_otur", { p_oda: odaId, p_koltuk: istemcidenDbye(koltuk) });
  if (error) throw error;
}

export async function koltuktanKalk(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("koltuktan_kalk", { p_oda: odaId });
  if (error && !tabloYok(error)) throw error;
}

export async function koltukMicAyarla(odaId: number, acik: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("koltuk_mic", { p_oda: odaId, p_acik: acik });
  if (error) throw error;
}

export async function koltukKilitle(odaId: number, koltuk: number, kilit: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("koltuk_kilit", { p_oda: odaId, p_koltuk: istemcidenDbye(koltuk), p_kilit: kilit });
  if (error) throw error;
}

/**
 * Koltuk değişimlerini canlı dinle.
 *
 * İKİ KANALLI: gelen olayın kendisi zaten yeni satırı taşıyor (`REPLICA
 * IDENTITY FULL`), o yüzden `anlik` ile HEMEN uygulanıyor — ekranın sunucuya
 * bir tur daha gidip gelmesini beklemesine gerek yok. Gecikmenin hissedilen
 * kısmı buydu.
 *
 * `tazele` ise kısa bir gecikmeyle çalışıyor: olay yükünde kullanıcının adı
 * ve fotoğrafı yok (join yapılmıyor), onları tam okuma getiriyor. Ayrıca tek
 * bir "otur" işlemi eski koltuğu boşaltıp yenisini doldurduğu için iki olay
 * üretiyor; tazeleme onları tek okumada birleştiriyor.
 */
export function koltuklariDinle(
  odaId: number,
  isleyiciler: { anlik: (satir: KoltukSatiri, silindi: boolean) => void; tazele: () => void },
): () => void {
  const sb = supabase;
  if (!sb) return () => {};
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  const ch = sb
    .channel(benzersizKanalAdi(`oda-koltuk-${odaId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "oda_koltuklari", filter: `oda_id=eq.${odaId}` },
      (yuk) => {
        const silindi = yuk.eventType === "DELETE";
        const ham = (silindi ? yuk.old : yuk.new) as Partial<KoltukRow> | undefined;
        if (ham?.koltuk_no != null) {
          isleyiciler.anlik(
            {
              koltukNo: dbdenIstemciye(Number(ham.koltuk_no)),
              kullaniciId: ham.kullanici_id == null ? null : Number(ham.kullanici_id),
              micAcik: !ham.susturulmus,
              kilitli: !!ham.kilitli,
              // Ad/foto olay yükünde yok; tazeleme dolduruyor.
              ad: null,
              foto: null,
              publicId: null,
              yetkili: false,
            },
            silindi,
          );
        }
        if (zamanlayici) clearTimeout(zamanlayici);
        zamanlayici = setTimeout(isleyiciler.tazele, 120);
      },
    )
    .subscribe((durum) => {
      if (durum !== "SUBSCRIBED") console.warn(`[koltuk] kanal ${durum}`);
    });
  return () => {
    if (zamanlayici) clearTimeout(zamanlayici);
    sb.removeChannel(ch);
  };
}

// ---------------------------------------------------------------------------
// MİKROFON AKIŞLARI (069) — indirme, sıra, onay
//
// Sıra eskiden broadcast'teydi: sonradan giren yönetici bekleyenleri
// göremiyor, bağlantı kopunca sıra siliniyor, "onaylandın" mesajı kaçarsa
// kimse koltuğa oturmuyordu. Sıra bir DURUM olduğu için tabloya taşındı;
// onay da artık sunucuda oturtuyor.
// ---------------------------------------------------------------------------

export type MicSirasiSatiri = { uid: number; name: string; photo?: string; publicId?: string; at: number };

/** Yönetici: hedefi mikrofondan indir (kendi koltuğun için koltuktanKalk). */
export async function koltuktanIndir(odaId: number, hedefId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("koltuktan_indir", { p_oda: odaId, p_hedef: hedefId });
  if (error) throw error;
}

export async function micSirasiGetir(odaId: number): Promise<MicSirasiSatiri[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("mic_sirasi_getir", { p_oda: odaId });
  if (error) {
    if (tabloYok(error)) return []; // 069 henüz çalıştırılmadı — ekran çalışsın
    throw error;
  }
  type Satir = { kullanici_id: number; kullanici_adi: string | null; profil_resmi: string | null; public_id: string | null; talep_tarihi: string };
  return ((data as Satir[]) ?? []).map((r) => ({
    uid: Number(r.kullanici_id),
    name: r.kullanici_adi || "Kullanıcı",
    photo: r.profil_resmi || undefined,
    publicId: r.public_id || undefined,
    at: Date.parse(r.talep_tarihi) || 0,
  }));
}

export async function micSirasinaGir(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("mic_sirasina_gir", { p_oda: odaId });
  if (error) throw error;
}

/** hedefId verilmezse kendi elimi indiriyorum. */
export async function micSirasindanCik(odaId: number, hedefId?: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("mic_sirasindan_cik", { p_oda: odaId, p_hedef: hedefId ?? null });
  if (error) throw error;
}

/**
 * Yönetici onayı (071).
 *
 * `koltuk` verilirse hedef O koltuğa oturuyor; verilmezse sunucu ilk boş ve
 * kilitsiz koltuğu seçiyor. Koltuğu ONAYLAYAN seçiyor — sıraya giren kişiye
 * sorulmuyor, o yalnızca el kaldırmış oluyor.
 */
export async function micSirasiOnayla(odaId: number, hedefId: number, koltuk?: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("mic_sirasi_onayla", {
    p_oda: odaId,
    p_hedef: hedefId,
    p_koltuk: koltuk == null ? null : istemcidenDbye(koltuk),
  });
  if (error) throw error;
}

/** Sıra değişimlerini canlı dinle (koltuklarla aynı desen). */
export function micSirasiniDinle(odaId: number, geriCagir: () => void): () => void {
  const sb = supabase;
  if (!sb) return () => {};
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  const ch = sb
    .channel(benzersizKanalAdi(`oda-mic-sirasi-${odaId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "oda_mic_sirasi", filter: `oda_id=eq.${odaId}` },
      () => {
        if (zamanlayici) clearTimeout(zamanlayici);
        zamanlayici = setTimeout(geriCagir, 80);
      },
    )
    .subscribe((durum) => {
      if (durum !== "SUBSCRIBED") console.warn(`[mic-sirasi] kanal ${durum}`);
    });
  return () => {
    if (zamanlayici) clearTimeout(zamanlayici);
    sb.removeChannel(ch);
  };
}

// ---------------------------------------------------------------------------
// ODADA KİM VAR (070) — sunucu taraflı katılım + kalp atışı
//
// Bu bilgi presence ile taşınıyordu ve üç oturum boyunca kararlı çalışmadı:
// ağ kopunca / arkaplandan dönünce liste boşalıyor, kişi sayısı 0 düşüyordu.
// Temel şemada hazır bekleyen `oda_katilimcilar` + `last_heartbeat` altyapısı
// devreye alındı; pg_cron olmadığı için bayat satırları katılım anında
// temizliyoruz ve okurken de eliyoruz.
// ---------------------------------------------------------------------------

export type OdaKatilimcisi = {
  uid: number;
  name: string;
  photo?: string;
  publicId?: string;
  yetkili: boolean;
  at: number;
};

/** Odaya katıldım — satır yoksa açılır, başka odadaysam bu odaya taşınır. */
export async function odayaKatil(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("odaya_katil", { p_oda: odaId });
  if (error && !tabloYok(error)) throw error;
}

/** "Hâlâ buradayım" — ~25 sn'de bir. */
export async function odaKalpAtisi(odaId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("oda_kalp_atisi", { p_oda: odaId });
  if (error && !tabloYok(error)) throw error;
}

export async function odadanAyril(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("odadan_ayril");
  if (error && !tabloYok(error)) throw error;
}

export async function odaKatilimcilariGetir(odaId: number): Promise<OdaKatilimcisi[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("oda_katilimcilari_getir", { p_oda: odaId });
  if (error) {
    if (tabloYok(error)) return []; // 070 henüz çalıştırılmadı
    throw error;
  }
  type Satir = { kullanici_id: number; kullanici_adi: string | null; profil_resmi: string | null; public_id: string | null; yetkili: boolean; giris_tarihi: string };
  return ((data as Satir[]) ?? []).map((r) => ({
    uid: Number(r.kullanici_id),
    name: r.kullanici_adi || "Kullanıcı",
    photo: r.profil_resmi || undefined,
    publicId: r.public_id || undefined,
    yetkili: !!r.yetkili,
    at: Date.parse(r.giris_tarihi) || 0,
  }));
}

/** Odaya giren/çıkanı canlı dinle. */
export function odaKatilimcilariniDinle(odaId: number, geriCagir: () => void): () => void {
  const sb = supabase;
  if (!sb) return () => {};
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  const ch = sb
    .channel(benzersizKanalAdi(`oda-katilimci-${odaId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "oda_katilimcilar", filter: `oda_id=eq.${odaId}` },
      () => {
        if (zamanlayici) clearTimeout(zamanlayici);
        zamanlayici = setTimeout(geriCagir, 120);
      },
    )
    .subscribe((durum) => {
      if (durum !== "SUBSCRIBED") console.warn(`[katilimci] kanal ${durum}`);
    });
  return () => {
    if (zamanlayici) clearTimeout(zamanlayici);
    sb.removeChannel(ch);
  };
}

/**
 * Oda listesi için kişi sayıları — gerçek katılımcı tablosundan (070).
 *
 * Eskiden bu sayı iki zayıf kaynağın birleşimiydi: istemcinin yazdığı
 * `odalar.aktif_katilimci_sayisi` (057) ve genel presence kanalı
 * (kaldırılan `odaVarlik.ts`). İkisi de kararsızdı; uygulama zorla kapanınca sayaç >0
 * kalıyor ve boş oda listede asılı duruyordu (hayalet oda). Artık sayı
 * kalp atışlı tablodan geliyor: kalbi durmuş kayıt zaten elenmiş oluyor.
 */
export async function odaKisiSayilari(): Promise<Map<number, number>> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("oda_kisi_sayilari");
  if (error) {
    if (tabloYok(error)) return new Map(); // 070 henüz çalıştırılmadı
    throw error;
  }
  const m = new Map<number, number>();
  for (const r of (data as { oda_id: number; sayi: number }[]) ?? []) {
    m.set(Number(r.oda_id), Number(r.sayi));
  }
  return m;
}

/** Herhangi bir odaya giriş/çıkış olduğunda haber ver (oda listesi için). */
export function odaKisiSayilariniDinle(geriCagir: () => void): () => void {
  const sb = supabase;
  if (!sb) return () => {};
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  const ch = sb
    .channel(benzersizKanalAdi("oda-kisi-sayilari"))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "oda_katilimcilar" },
      () => {
        if (zamanlayici) clearTimeout(zamanlayici);
        zamanlayici = setTimeout(geriCagir, 250);
      },
    )
    .subscribe((durum) => {
      if (durum !== "SUBSCRIBED") console.warn(`[oda-sayi] kanal ${durum}`);
    });
  return () => {
    if (zamanlayici) clearTimeout(zamanlayici);
    sb.removeChannel(ch);
  };
}
