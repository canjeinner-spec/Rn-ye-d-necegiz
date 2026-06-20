/**
 * Frontend veri tipleri — schema_v7.sql + schema_v7_eklentileri.sql ile BİREBİR.
 * Alan adları şemadaki gibi (Türkçe snake_case) → backend entegrasyonunda sıfır sürtünme.
 * Yalnızca UI'nin kullandığı alanlar; audit/risk/teknik kolonlar dahil edilmedi.
 */

// ── ENUM'lar ────────────────────────────────────────────────────────────────
export type KullaniciDurumu = "cevrimici" | "cevrimdisi" | "gizli" | "rahatsiz_etme";
export type EkonomiRolu = "standart" | "yayinci" | "bayi";
export type VarlikTipi = "elmas" | "altin" | "kazanc" | "fiat";
export type OdaRolu = "sahip" | "yonetici" | "moderator" | "uye";
export type AjansRolu = "yonetici" | "yayinci";
export type BildirimTipi =
  | "takip" | "dm" | "hediye" | "oda_davet" | "odeme" | "sistem"
  | "begeni" | "yorum" | "etkinlik" | "arkadaslik" | "gorev";
export type GonderiKapsami = "herkes" | "arkadaslar" | "takipciler";
export type EtkinlikDurumu = "taslak" | "yakinda" | "yayinda" | "bitti" | "iptal";
export type GorevTipi = "gunluk" | "haftalik" | "basarim";
export type OzelIdTier = "normal" | "super" | "altin" | "elmas" | "kral";
export type OzelIdDurumu = "musait" | "rezerve" | "satildi";
export type ArkadaslikDurumu = "beklemede" | "kabul" | "reddedildi";
export type LiderlikTipi = "gunluk_hediye" | "haftalik_hediye" | "aylik_hediye" | "oda" | "ajans";

// ── kullanicilar ──────────────────────────────────────────────────────────
export type Kullanici = {
  id: number;
  public_id: string;
  kullanici_adi: string;
  profil_resmi?: string | null;
  biyografi?: string | null;
  dogum_tarihi?: string | null;
  cinsiyet?: "e" | "k" | null;
  ulke?: string | null;
  sehir?: string | null;
  durum: KullaniciDurumu;
  son_gorulme?: string | null;
  deneyim_puani: number;
  seviye_id?: number | null;
  ekonomi_rolu: EkonomiRolu;
  cached_total_balance: number;       // elmas
  cached_altin_balance: number;       // altın
  kazanc_puani: number;               // yayıncı kazancı
  rozetler?: number[];                // kullanici_rozetleri → rozet id'leri
};

// ── seviyeler / rozetler ────────────────────────────────────────────────────
export type Seviye = { id: number; ad: string; minimum_deneyim_puani: number; ikon_url?: string | null };
export type Rozet = { id: number; ad: string; aciklama?: string | null; ikon_url?: string | null };

// ── DM ──────────────────────────────────────────────────────────────────────
export type DMKonusma = {
  id: number;
  karsi_kullanici: Pick<Kullanici, "id" | "public_id" | "kullanici_adi" | "profil_resmi" | "durum">;
  son_mesaj?: string;
  son_mesaj_tarihi?: string;
  okunmamis_sayisi: number;
};

export type DMMesaj = {
  id: number;
  konusma_id: number;
  gonderen_id: number;
  icerik: string;
  okundu: boolean;
  gonderilme_tarihi: string;
  benim_mesajim?: boolean;
};

// ── bildirimler ───────────────────────────────────────────────────────────
export type Bildirim = {
  id: number;
  tip: BildirimTipi;
  baslik?: string | null;
  icerik?: string | null;
  veri?: Record<string, unknown> | null;
  okundu: boolean;
  olusturulma_tarihi: string;
};

// ── sosyal akış (feed) ──────────────────────────────────────────────────────
export type Gonderi = {
  id: number;
  public_id: string;
  yazar: Pick<Kullanici, "id" | "public_id" | "kullanici_adi" | "profil_resmi">;
  icerik?: string | null;
  medya?: string[];
  kapsam: GonderiKapsami;
  begeni_sayisi: number;
  yorum_sayisi: number;
  begendim?: boolean;
  duzenlendi?: boolean;
  olusturulma_tarihi: string;
};

export type GonderiYorum = {
  id: number;
  gonderi_id: number;
  yazar: Pick<Kullanici, "id" | "kullanici_adi" | "profil_resmi">;
  ust_yorum_id?: number | null;
  icerik: string;
  begeni_sayisi: number;
  olusturulma_tarihi: string;
};

// ── etkinlikler ─────────────────────────────────────────────────────────────
export type Etkinlik = {
  id: number;
  public_id: string;
  ad: string;
  aciklama?: string | null;
  kapak_url?: string | null;
  tip?: string | null;
  durum: EtkinlikDurumu;
  baslangic_tarihi?: string | null;
  bitis_tarihi?: string | null;
  odul_aciklama?: string | null;
  katilimci_sayisi: number;
  katildim?: boolean;
};

// ── görevler / günlük ödül ─────────────────────────────────────────────────
export type Gorev = {
  id: number;
  kod: string;
  ad: string;
  aciklama?: string | null;
  tip: GorevTipi;
  hedef_sayi: number;
  odul_varlik: VarlikTipi;
  odul_miktar: number;
  ilerleme?: number;
  tamamlandi?: boolean;
  odul_alindi?: boolean;
};

export type GunlukOdul = { gun_no: number; varlik: VarlikTipi; miktar: number };

// ── liderlik (rank) ──────────────────────────────────────────────────────────
export type LiderlikGiris = {
  sira: number;
  puan: number;
  kullanici?: Pick<Kullanici, "id" | "public_id" | "kullanici_adi" | "profil_resmi">;
  oda?: { id: number; public_id: string; ad: string; kapak_url?: string | null };
  ajans?: { id: number; public_id: string; ad: string };
};

// ── ajans ────────────────────────────────────────────────────────────────────
export type Ajans = {
  id: number;
  public_id: string;
  ad: string;
  sahip?: Pick<Kullanici, "id" | "kullanici_adi"> | null;
  komisyon_orani: number;
  uye_sayisi?: number;
};

// ── profil ziyaretleri / referral / özel id ─────────────────────────────────
export type ProfilZiyaret = {
  ziyaretci: Pick<Kullanici, "id" | "public_id" | "kullanici_adi" | "profil_resmi">;
  ziyaret_tarihi: string;
};

export type OzelId = {
  id: number;
  deger: string;
  tier: OzelIdTier;
  fiyat_elmas: number;
  sure_gun?: number | null;
  durum: OzelIdDurumu;
};
