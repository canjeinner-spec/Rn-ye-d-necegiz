import { searchProfiles, type PublicProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

/** Platform rolü ata (yalnızca super_admin — 024_platform_rol.sql). */
export async function setPlatformRole(userId: number, rol: "user" | "developer" | "super_admin"): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("platform_rol_ata", { p_hedef: userId, p_rol: rol });
  if (error) throw error;
}

/** Kullanıcının özel-ID hak durumu (yönetici — 047). */
export async function getUserHaklar(userId: number): Promise<{ beta_tester: boolean; premium_hak: boolean; ozel_id: string | null; ozel_id_tip: string | null }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_kullanici_haklar", { p_hedef: userId });
  if (error) throw error;
  const r = (data as { beta_tester: boolean; premium_hak: boolean; ozel_id: string | null; ozel_id_tip: string | null }[])?.[0];
  return r ?? { beta_tester: false, premium_hak: false, ozel_id: null, ozel_id_tip: null };
}

/** beta_tester / premium_hak ver-al (yalnızca yönetici — 044 admin_hak_ata). */
export async function setUserHak(userId: number, alan: "beta_tester" | "premium_hak", deger: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_hak_ata", { p_hedef: userId, p_alan: alan, p_deger: deger });
  if (error) throw error;
}

/** Yönetim ekranı üst sayıları. */
export async function getAdminCounts(): Promise<{ bekleyen: number; kullanici: number }> {
  const sb = requireSupabase();
  const [reports, users] = await Promise.all([
    sb.from("sikayetler").select("id", { count: "exact", head: true }).eq("durum", "bekliyor"),
    sb.from("profiller").select("id", { count: "exact", head: true }),
  ]);
  return { bekleyen: reports.count ?? 0, kullanici: users.count ?? 0 };
}

// ---- Bakiye (027_cuzdan) ---------------------------------------------------
/** Kullanıcıya varlık ver/al (yönetici). miktar +/-. */
export async function grantBalance(userId: number, varlik: "elmas" | "altin", miktar: number, sebep?: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("bakiye_ekle", { p_hedef: userId, p_varlik: varlik, p_miktar: miktar, p_sebep: sebep ?? null });
  if (error) throw error;
}

// ---- Mic yasağı (028_mic_yasak) --------------------------------------------
/** Platform mic-yasağı ver. dakika null → kalıcı. */
export async function micBan(userId: number, sebep: string | null, dakika: number | null): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("mic_yasak_ver", { p_hedef: userId, p_sebep: sebep, p_dakika: dakika });
  if (error) throw error;
}
export async function micUnban(userId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("mic_yasak_kaldir", { p_hedef: userId });
  if (error) throw error;
}

// ---- Kullanıcı arama + detay (029_admin_kullanici) -------------------------
export async function searchUsers(query: string): Promise<PublicProfile[]> {
  return searchProfiles(query);
}

export type AdminUserDetail = {
  id: number;
  publicId: string;
  name: string;
  photo?: string;
  email: string | null; // yalnızca developer'a dolu gelir
  rol: "user" | "developer" | "super_admin";
  level: number;
  xp: number;
  elmas: number;
  altin: number;
  elmasDondu: boolean;
  altinDondu: boolean;
  micBanned: boolean;
  micSebep: string | null;
  micBitis: number | null; // epoch ms | null(kalıcı ya da yasak yok)
  hesapYasakli: boolean;
  hesapSebep: string | null;
  hesapBitis: number | null; // epoch ms | null
  raporSayisi: number;
  kayitTarihi: number | null; // epoch ms (auth.users.created_at)
};

export async function getUserDetail(userId: number): Promise<AdminUserDetail | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_kullanici_getir", { p_hedef: userId });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    id: r.id,
    publicId: r.public_id,
    name: r.kullanici_adi,
    photo: r.profil_resmi || undefined,
    email: r.email ?? null,
    rol: (r.rol as AdminUserDetail["rol"]) ?? "user",
    level: r.seviye_id ?? 1,
    xp: Number(r.deneyim_puani ?? 0),
    elmas: Number(r.elmas ?? 0),
    altin: Number(r.altin ?? 0),
    elmasDondu: !!r.elmas_dondu,
    altinDondu: !!r.altin_dondu,
    micBanned: !!r.mic_yasakli,
    micSebep: r.mic_sebep ?? null,
    micBitis: r.mic_bitis ? new Date(r.mic_bitis).getTime() : null,
    hesapYasakli: !!r.hesap_yasakli,
    hesapSebep: r.hesap_sebep ?? null,
    hesapBitis: r.hesap_bitis ? new Date(r.hesap_bitis).getTime() : null,
    raporSayisi: Number(r.rapor_sayisi ?? 0),
    kayitTarihi: r.kayit_tarihi ? new Date(r.kayit_tarihi).getTime() : null,
  };
}

/** Ad ve/veya avatar güncelle (developer & super_admin). avatar "" → kaldır. */
export async function updateUserIdentity(userId: number, ad?: string, avatar?: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_kullanici_guncelle", {
    p_hedef: userId, p_ad: ad ?? null, p_avatar: avatar ?? null,
  });
  if (error) throw error;
}

// ---- Varlık dondurma (034_dondurma) ----------------------------------------
/** Elmas/altın dondur (harcama/transfer kilidi) ya da çöz. */
export async function freezeAsset(userId: number, varlik: "elmas" | "altin", dondur: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_varlik_dondur", { p_hedef: userId, p_varlik: varlik, p_dondur: dondur });
  if (error) throw error;
}

// ---- Hesap (uygulama) yasağı (035_hesap_yasak) -----------------------------
/** Hesabı uygulamadan yasakla. dakika null → kalıcı. */
export async function accountBan(userId: number, sebep: string | null, dakika: number | null): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("hesap_yasak_ver", { p_hedef: userId, p_sebep: sebep, p_dakika: dakika });
  if (error) throw error;
}
export async function accountUnban(userId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("hesap_yasak_kaldir", { p_hedef: userId });
  if (error) throw error;
}

// ---- developer-özel: ID + şifre + e-posta ----------------------------------
export async function changePublicId(userId: number, yeni: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_public_id_degistir", { p_hedef: userId, p_yeni: yeni.trim() });
  if (error) throw error;
}
export async function resetPassword(userId: number, yeni: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_sifre_sifirla", { p_hedef: userId, p_yeni: yeni });
  if (error) throw error;
}
export async function changeEmail(userId: number, yeni: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_email_degistir", { p_hedef: userId, p_yeni: yeni.trim() });
  if (error) throw error;
}

// ---- İşlem geçmişi / denetim izi (033_yonetici_islem) ----------------------
export type AdminAction = {
  id: number;
  islem: string;
  detay: string | null;
  at: number; // epoch ms
  actorId: number | null;
  actorName: string;
  actorPublicId: string | null;
  actorRol: string | null;
};

/** Bir hedefe (kullanıcı/oda) uygulanan yönetici işlemleri (yeniden eskiye). */
export async function getActionHistory(hedefTip: "kullanici" | "oda", hedefId: number): Promise<AdminAction[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_islem_gecmisi", { p_tip: hedefTip, p_id: hedefId });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as {
    id: number; islem: string; detay: string | null; tarih: string;
    yapan_id: number | null; yapan_ad: string | null; yapan_public_id: string | null; yapan_rol: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    islem: r.islem,
    detay: r.detay ?? null,
    at: new Date(r.tarih).getTime(),
    actorId: r.yapan_id ?? null,
    actorName: r.yapan_ad || "Bilinmiyor",
    actorPublicId: r.yapan_public_id ?? null,
    actorRol: r.yapan_rol ?? null,
  }));
}

// ---- Oda düzenleme (036_oda_yonet) -----------------------------------------
export type AdminRoomEdit = {
  id: number;
  publicId: string;
  ad: string;
  aciklama: string | null;
  kategori: string | null;
  photo?: string;
  herkeseAcik: boolean;
  hostName: string;
  hostPublicId: string | null;
  uyeSayisi: number;
  aktifKatilimci: number;
};

export async function getRoomForEdit(odaId: number): Promise<AdminRoomEdit | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_oda_getir", { p_oda: odaId });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    id: r.id,
    publicId: r.public_id,
    ad: r.ad,
    aciklama: r.aciklama ?? null,
    kategori: r.kategori ?? null,
    photo: r.kapak_url || undefined,
    herkeseAcik: !!r.herkese_acik,
    hostName: r.sahip_ad || "Kullanıcı",
    hostPublicId: r.sahip_public_id ?? null,
    uyeSayisi: Number(r.uye_sayisi ?? 0),
    aktifKatilimci: Number(r.aktif_katilimci ?? 0),
  };
}
export type AdminRoomHit = { id: number; publicId: string | null; ad: string; photo?: string };
/** İsim veya public ID ile oda ara (odaya mesaj hedefi seçimi için). */
export async function searchRooms(query: string): Promise<AdminRoomHit[]> {
  const sb = requireSupabase();
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await sb
    .from("odalar")
    .select("id, public_id, ad, kapak_url")
    .or(`ad.ilike.%${q}%,public_id.ilike.%${q}%`)
    .limit(20);
  if (error) throw error;
  return ((data as { id: number; public_id: string | null; ad: string; kapak_url: string | null }[]) ?? []).map((r) => ({
    id: r.id, publicId: r.public_id, ad: r.ad, photo: r.kapak_url || undefined,
  }));
}
export async function updateRoom(odaId: number, ad: string, aciklama: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_oda_guncelle", { p_oda: odaId, p_ad: ad.trim(), p_aciklama: aciklama.trim() || null });
  if (error) throw error;
}
export async function changeRoomPublicId(odaId: number, yeni: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_oda_public_id_degistir", { p_oda: odaId, p_yeni: yeni.trim() });
  if (error) throw error;
}
/**
 * Oda kapağını ayarla / kaldır (053_admin_oda_kapak). null → kapağı kaldırır.
 * 036'daki admin_oda_guncelle yalnız ad + açıklama alıyordu, bu yüzden
 * yönetici uygunsuz bir kapağı kaldıramıyordu.
 */
export async function setRoomCover(odaId: number, kapak: string | null): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_oda_kapak_ayarla", { p_oda: odaId, p_kapak: kapak });
  if (error) throw error;
}

// ---- İçerik (031_admin_icerik): yönetici herhangi bir gönderiyi siler ------
export async function deleteAnyPost(postDbId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_gonderi_sil", { p_gonderi_id: postDbId });
  if (error) throw error;
}
