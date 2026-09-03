#!/usr/bin/env node
/**
 * Gomulu gorselli Lottie dosyalarini kucultur ve istege bagli olarak
 * zeminini seffaflastirir.
 *
 * NEDEN VAR: bazi "Lottie" dosyalari aslinda VIDEO. Kare basina bir gomulu
 * gorsel koyuyorlar (her katman ty:2 ve tam 1 kare yasar, ayni anda ekranda
 * tek katman olur). Vektor olmadigi icin CIZMESI ucuz ama BELLEK pahali:
 * lottie-android cozdugu bitmap'leri kompozisyon boyunca tutuyor, yani
 * 97 kare x 800x800 ARGB_8888 = ~237 MB. Orta seviye Android'de cokme demek.
 * Kenari 320'ye indirmek bellegi ~6 kat dusuruyor ve efekt zaten 260-300
 * piksel cizildigi icin gozle fark edilmiyor.
 *
 * KULLANIM:
 *   node scripts/lottie-gorsel-kucult.js girdi.json cikti.json
 *        [--kenar 320] [--zemin-sil] [--esik 232]
 *
 * Gomulu gorseli olmayan dosyada hicbir sey yapmaz (vektor Lottie'lere
 * dokunmaz) — onlarin boyutu zaten gorselden gelmiyor.
 */
const fs = require("fs");
const sharp = require("sharp");

const SAYI_ALAN = new Set(["--kenar", "--esik"]);
const serbest = process.argv.slice(2);
const [girdi, cikti] = serbest.filter((a, i) => !a.startsWith("--") && !SAYI_ALAN.has(serbest[i - 1]));

function say(ad, varsayilan) {
  const i = process.argv.indexOf("--" + ad);
  return i > -1 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : varsayilan;
}
const kenar = say("kenar", 320);
const esik = say("esik", 232);
const zeminSil = process.argv.includes("--zemin-sil");

if (!girdi || !cikti) {
  console.error("Kullanim: node scripts/lottie-gorsel-kucult.js girdi.json cikti.json [--kenar 320] [--zemin-sil]");
  process.exit(1);
}

/**
 * KENARDAN TASMA DOLGUSU ile zemin silme.
 *
 * Duz "beyazi seffaf yap" YAPILAMAZ: Noel Baba'nin sakali, kurk kenari ve
 * ponponu da beyaz — karakterin icinde delik acardi. Onun yerine yalnizca
 * GORUNTU SINIRINA BAGLI beyaz bolge seffaflasiyor. Karakterin ici siyah
 * konturla cevrili oldugu icin dolgu oraya sizamiyor.
 *
 * Kaynak gorselde alfa yoksa (WebP 3 kanal) bu sart: yoksa hediye koyu
 * temanin ustunde beyaz bir kutu olarak cikiyor.
 */
async function zeminiSil(ham) {
  const { data, info } = await sharp(ham).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: K } = info;
  const acikMi = (i) => data[i] > esik && data[i + 1] > esik && data[i + 2] > esik;
  const gorulen = new Uint8Array(W * H);
  const yigin = [];
  for (let x = 0; x < W; x++) { yigin.push(x); yigin.push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { yigin.push(y * W); yigin.push(y * W + W - 1); }
  while (yigin.length) {
    const p = yigin.pop();
    if (gorulen[p]) continue;
    const i = p * K;
    if (!acikMi(i)) continue;
    gorulen[p] = 1;
    data[i + 3] = 0;
    const x = p % W, y = (p - x) / W;
    if (x > 0) yigin.push(p - 1);
    if (x < W - 1) yigin.push(p + 1);
    if (y > 0) yigin.push(p - W);
    if (y < H - 1) yigin.push(p + W);
  }
  return sharp(data, { raw: { width: W, height: H, channels: K } }).png().toBuffer();
}

(async () => {
  const j = JSON.parse(fs.readFileSync(girdi, "utf8"));
  const varliklar = (j.assets || []).filter((a) => a.p && String(a.p).startsWith("data:"));
  if (!varliklar.length) {
    console.log("Gomulu gorsel yok, dosya oldugu gibi birakildi.");
    process.exit(0);
  }

  let oncePiksel = 0, sonraPiksel = 0;
  for (const a of varliklar) {
    const veri = String(a.p);
    let ham = Buffer.from(veri.slice(veri.indexOf(",") + 1), "base64");
    oncePiksel += a.w * a.h;

    // FORMAT KORUNUYOR. Ilk denemede hepsi PNG'ye cevrildi ve dosya
    // 1328 -> 2359 KB BUYUDU: kaynak kareler WebP'ti ve zaten cok iyi
    // sikistirilmisti (800x800 icin 10 KB). Ayni formatta yeniden kodlamak
    // hem kucultuyor hem de oynaticinin cozebildigi formati degistirmiyor.
    const bicim = (await sharp(ham).metadata()).format;
    if (zeminSil) ham = await zeminiSil(ham);

    let boru = sharp(ham).resize(kenar, kenar, { fit: "inside", withoutEnlargement: true });
    // Zemin silindiyse alfa SART; alfasiz formata geri donmek seffafligi yok eder.
    if (bicim === "webp") boru = boru.webp({ quality: 82, alphaQuality: 100 });
    else if (bicim === "jpeg" && !zeminSil) boru = boru.jpeg({ quality: 86 });
    else boru = boru.png({ compressionLevel: 9, palette: true });
    const yeni = await boru.toBuffer();

    const olcu = await sharp(yeni).metadata();
    // Lottie katman donusumleri varligin w/h'sine gore olceklendigi icin
    // ikisini de guncellemek SART; yoksa gorsel yanlis boyutta cizilir.
    a.w = olcu.width;
    a.h = olcu.height;
    a.p = "data:image/" + (olcu.format === "jpeg" ? "jpeg" : olcu.format) + ";base64," + yeni.toString("base64");
    sonraPiksel += a.w * a.h;
  }

  fs.writeFileSync(cikti, JSON.stringify(j));
  const mb = (px) => ((px * 4) / 1048576).toFixed(0);
  const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0);
  console.log("gorsel: " + varliklar.length + " adet" + (zeminSil ? "  (zemin silindi)" : ""));
  console.log("dosya : " + kb(girdi) + " KB -> " + kb(cikti) + " KB");
  console.log("bellek: ~" + mb(oncePiksel) + " MB -> ~" + mb(sonraPiksel) + " MB  (ARGB_8888, hepsi cozulmus halde)");
})();
