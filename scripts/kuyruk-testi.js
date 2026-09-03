#!/usr/bin/env node
/**
 * Hediye efekti kuyrugu testi — `src/gifts/efektKuyrugu.ts`.
 *
 * NEDEN VAR: kuyrugun davranisi hakkinda somut iddialar var ("100 kisi ayni
 * anda atsa cokmez", "efsanevi dusurulmez", "kimse cok beklemez"). Bunlar
 * denenmeden soylenmemeli. Modul saf fonksiyonlardan olustugu icin cihaz
 * gerekmeden calistirilabiliyor.
 *
 * KULLANIM: node scripts/kuyruk-testi.js
 *
 * Modul once TypeScript'ten derleniyor, sonra `bigGifts` (icinde .wav ve
 * .json require'lari var, Node'da yuklenemez) taklitle degistiriliyor.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const kok = path.join(__dirname, "..");
const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "kuyruk-testi-"));

try {
  execFileSync(process.execPath, [
    path.join(kok, "node_modules", "typescript", "bin", "tsc"),
    path.join(kok, "src", "gifts", "efektKuyrugu.ts"),
    "--outDir", gecici,
    "--module", "commonjs", "--target", "es2020",
    "--skipLibCheck", "--esModuleInterop",
  ], { stdio: "pipe" });
} catch {
  // tsc `@/data/gifts` yolunu cozemedigi icin hata koduyla cikiyor ama JS'i
  // yine de yaziyor. Cikti dosyasi varsa devam.
}
const derlenmis = path.join(gecici, "efektKuyrugu.js");
if (!fs.existsSync(derlenmis)) {
  console.error("Derleme basarisiz: " + derlenmis + " olusmadi.");
  process.exit(1);
}

const asil = Module._load;
Module._load = function (istek) {
  if (istek === "./bigGifts") {
    return { sceneFor: (id) => ({ duration: id === "kaplan" ? 6000 : 4000, anim: () => 1 }) };
  }
  if (istek === "@/data/gifts") return {};
  return asil.apply(this, arguments);
};

const K = require(derlenmis);

const hediye = (id, tier) => ({ id, tier, emoji: "x", name: id, price: 1, c1: "#000", c2: "#111" });
const is = (id, tier, kim, qty = 1) => ({ anahtar: K.yeniAnahtar(), gift: hediye(id, tier), qty, gonderen: kim });

let gecti = 0, kaldi = 0;
const kontrol = (ad, kosul) => {
  if (kosul) { gecti++; console.log("  TAMAM  " + ad); }
  else { kaldi++; console.log("  KALDI  " + ad); }
};

let k = K.kuyrugaEkle([], is("gul", "normal", "Ali"));
kontrol("bos kuyruga eklenir", k.length === 1);

// Gosterilen isin adedi animasyon ortasinda degismemeli.
k = K.kuyrugaEkle(k, is("gul", "normal", "Ali"));
kontrol("aktif isle birlestirilmez", k.length === 2);

k = K.kuyrugaEkle(k, is("gul", "normal", "Ali", 3));
kontrol("bekleyen ayni hediye birlestirilir", k.length === 2 && k[1].qty === 4);

k = K.kuyrugaEkle(k, is("gul", "normal", "Veli"));
kontrol("farkli gonderen ayri sirada", k.length === 3);

// Odada 100 kisi ayni anda atarsa kuyruk sinirsiz buyumemeli.
let yogun = [];
for (let i = 0; i < 100; i++) yogun = K.kuyrugaEkle(yogun, is("gul", "normal", "kisi" + i));
kontrol("100 gonderimde kuyruk tavanda (" + yogun.length + " <= " + K.KUYRUK_TAVAN + ")",
  yogun.length <= K.KUYRUK_TAVAN);

let karisik = [is("gul", "normal", "a")];
karisik = K.kuyrugaEkle(karisik, is("hazine", "legendary", "b"));
for (let i = 0; i < 40; i++) karisik = K.kuyrugaEkle(karisik, is("kedi", "normal", "n" + i));
kontrol("kalabalikta efsanevi dusurulmuyor", karisik.some((i) => i.gift.tier === "legendary"));
kontrol("gosterilen is korunuyor", karisik[0].gift.id === "gul");

const tek = K.gosterimSuresi(is("kaplan", "epic", "a"), 1);
const orta = K.gosterimSuresi(is("kaplan", "epic", "a"), 4);
const yogunSure = K.gosterimSuresi(is("kaplan", "epic", "a"), 10);
kontrol("sure kuyrukla kisaliyor (" + tek + " > " + orta + " > " + yogunSure + ")",
  tek > orta && orta > yogunSure);

kontrol("efsanevi goz kirpmasi kadar kisalmiyor",
  K.gosterimSuresi(is("hazine", "legendary", "a"), 30) >= 1200);

let toplam = 0, sira = yogun.slice();
while (sira.length) { toplam += K.gosterimSuresi(sira[0], sira.length); sira = sira.slice(1); }
kontrol("dolu kuyruk " + (toplam / 1000).toFixed(1) + " sn'de bosaliyor (<20 sn)", toplam < 20000);

console.log("");
console.log(gecti + " gecti, " + kaldi + " kaldi");
process.exit(kaldi ? 1 : 0);
