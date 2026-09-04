import { type SiraKisi, type SiraOda } from "@/data/remote/siralamaRepo";

/**
 * GEÇİCİ MOCK SIRALAMA VERİSİ — SİLİNECEK.
 *
 * NEDEN VAR: kapalı betada iki kullanıcı ve iki oda var; podyumun altındaki
 * liste hiç dolmuyor ve uzun listenin nasıl göründüğü görülemiyor. Bu dosya
 * 4. sıradan 30'a kadar sahte kayıt üretiyor.
 *
 * NASIL SİLİNİR: `MOCK_ACIK` false yapmak yeter (ekran gerçek veriye döner);
 * tamamen kaldırmak için bu dosyayı sil ve `rank.tsx` içindeki üç `mock…`
 * çağrısını çıkar. Eklendiği commit tek başına revert edilebilir.
 *
 * DİKKAT: sahte kayıtların `uid`/`odaId`si NEGATİF. Gerçek kimliklerle
 * çakışmasın diye böyle; bir yere sızarsa da hemen belli olsun.
 */
export const MOCK_ACIK = true;

const ADLAR = [
  "Deniz", "Kerem", "Elif", "Barış", "Selin", "Mert", "Yağmur", "Cem",
  "Zeynep", "Onur", "İrem", "Kaan", "Buse", "Emre", "Aslı", "Tolga",
  "Melis", "Serkan", "Ceren", "Burak", "Gizem", "Uğur", "Pelin", "Hakan",
  "Sude", "Efe", "Nazlı",
];

/** Kuşanılan rozet çeşitlensin diye — hepsi gerçek rozet kodları. */
const ROZETLER = [
  "room_weekly_champion",
  "room_top_gifter",
  undefined,
  "room_rising_star",
  undefined,
  "room_daily_streak",
  "room_rank_silver",
  undefined,
];

const ODA_ADLARI = [
  "Gece Kuşları", "Sohbet Durağı", "Altın Kafe", "Muhabbet Bahçesi",
  "Yıldız Sahne", "Kahve Molası", "Anadolu Sohbet", "Rüzgar Odası",
  "Mavi Salon", "Neşe Kulübü", "Sessiz Liman", "Kelebek Odası",
];

/** Listeyi 30. sıraya kadar sahte kayıtla doldurur. */
export function mockKisiEkle(gercek: SiraKisi[], hedef = 30): SiraKisi[] {
  if (!MOCK_ACIK) return gercek;
  const cikti = [...gercek];
  let puan = gercek.length ? gercek[gercek.length - 1].puan : 9_500_000;
  for (let i = gercek.length; i < hedef; i++) {
    puan = Math.max(750, Math.floor(puan * 0.86) - 4321);
    cikti.push({
      sira: i + 1,
      uid: -(i + 1),
      publicId: `mock-kisi-${i + 1}`,
      ad: ADLAR[i % ADLAR.length],
      rozet: ROZETLER[i % ROZETLER.length],
      puan,
    });
  }
  return cikti;
}

/** Oda listesini 30. sıraya kadar sahte kayıtla doldurur. */
export function mockOdaEkle(gercek: SiraOda[], hedef = 30): SiraOda[] {
  if (!MOCK_ACIK) return gercek;
  const cikti = [...gercek];
  let puan = gercek.length ? gercek[gercek.length - 1].puan : 14_000_000;
  for (let i = gercek.length; i < hedef; i++) {
    puan = Math.max(500, Math.floor(puan * 0.84) - 7654);
    cikti.push({
      sira: i + 1,
      odaId: -(i + 1),
      publicId: `mock-oda-${i + 1}`,
      ad: ODA_ADLARI[i % ODA_ADLARI.length],
      sahip: ADLAR[(i * 3) % ADLAR.length],
      online: Math.max(1, 40 - i),
      puan,
    });
  }
  return cikti;
}
