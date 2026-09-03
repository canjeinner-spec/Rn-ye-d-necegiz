import { type Gift } from "@/data/gifts";
import { sceneFor } from "./bigGifts";

/**
 * Hediye efekti kuyruğu — politika burada, ekran kodu ince kalsın diye.
 *
 * NEDEN VAR: efektler üst üste biniyordu ve bazen yeni hediye anında
 * kayboluyordu. İkincisi gerçek bir hataydı: zamanlayıcı hangi hediyenin
 * gösterildiğine BAKMADAN efekti siliyordu, yani A hediyesinin sayacı B
 * gösterilirken patlayınca B'yi düşürüyordu.
 *
 * KURULUŞ FİKRİ: efektler sıraya girer, biri bitmeden diğeri başlamaz. Ama
 * sıra beklemek de bedava değil — odada aynı anda çok kişi hediye atarsa
 * kuyruk dakikalarca sürebilir. Bu yüzden kuyruk UZADIKÇA gösterim SÜRESİ
 * KISALIYOR: sakin odada hediye tam boy oynar, yoğunlukta akış hızlanır.
 * Kimse hediyesinin sırasını uzun süre beklemez.
 */

export type EfektIsi = {
  /** Benzersiz — React anahtarı ve "hâlâ bu mu oynuyor" kontrolü için. */
  anahtar: string;
  gift: Gift;
  qty: number;
  gonderen: string;
};

/**
 * Kuyrukta en fazla bu kadar iş durur. Aşılırsa en eski EFSANEVİ OLMAYAN iş
 * düşürülür — kalabalıkta 500 gül birikip pahalı hediyeyi bekletmesin.
 * Gösterilmekte olan iş (0. sıra) asla düşürülmez.
 */
export const KUYRUK_TAVAN = 12;

/** Bu hediyenin doğal gösterim süresi (ms). */
function temelSure(gift: Gift): number {
  const sahne = sceneFor(gift.id);
  if (sahne.anim) return sahne.duration;
  return gift.tier === "epic" ? 3000 : 2400;
}

/**
 * Bir işin ne kadar gösterileceği. `bekleyen` = kuyruktaki toplam iş sayısı
 * (gösterilen dahil).
 *
 * Kademeler ölçüye değil karara dayanıyor: tek hediye varsa acele yok, kuyruk
 * büyüdükçe akış hızlanıyor. Efsanevi hediye ücretli bir gösteri olduğu için
 * hiçbir zaman göz kırpması kadar kısalmıyor (alt sınır 1200 ms).
 */
export function gosterimSuresi(is: EfektIsi, bekleyen: number): number {
  const temel = temelSure(is.gift);
  let sure = temel;
  if (bekleyen > 6) sure = Math.min(temel, 900);
  else if (bekleyen > 3) sure = Math.min(temel, 1400);
  else if (bekleyen > 1) sure = Math.min(temel, 2200);
  if (is.gift.tier === "legendary") sure = Math.max(sure, Math.min(temel, 1200));
  return sure;
}

/**
 * Kuyruğa ekler.
 *
 * BİRLEŞTİRME: aynı kişi aynı hediyeyi tekrar atarsa yeni sıra açılmaz,
 * bekleyen işin adedi artar. "×1 gül" beş kez değil, bir kez "×5 gül"
 * görünür — hem daha doğru hem kuyruk şişmez. Gösterilmekte olan işe
 * dokunulmaz; ekrandaki sayı animasyon ortasında değişmesin.
 */
export function kuyrugaEkle(kuyruk: EfektIsi[], yeni: EfektIsi): EfektIsi[] {
  const ix = kuyruk.findIndex(
    (i, sira) => sira > 0 && i.gift.id === yeni.gift.id && i.gonderen === yeni.gonderen,
  );
  if (ix > 0) {
    const kopya = kuyruk.slice();
    kopya[ix] = { ...kopya[ix], qty: kopya[ix].qty + yeni.qty };
    return kopya;
  }

  const sonuc = [...kuyruk, yeni];
  if (sonuc.length <= KUYRUK_TAVAN) return sonuc;

  // Tavan aşıldı: gösterilen işten SONRAKİ en eski efsanevi olmayanı düşür.
  const dusurulecek = sonuc.findIndex((i, sira) => sira > 0 && i.gift.tier !== "legendary");
  const hedef = dusurulecek > 0 ? dusurulecek : 1; // hepsi efsaneviyse en eskisi
  return sonuc.filter((_, sira) => sira !== hedef);
}

let sayac = 0;
export const yeniAnahtar = () => "efekt" + ++sayac;
