/**
 * Podyum çerçevelerini üretilen sayfadan hazırlar + sahne arkaplanını küçültür.
 *
 * KULLANIM
 *   node scripts/cerceve-hazirla.js <sayfa.png>            # 3'lü ya da 6'lı sayfa
 *   node scripts/cerceve-hazirla.js --sahne <arkaplan.png> # salon arkaplanı
 *
 * SAYFA DÜZENİ
 *   3 delik → tek sıra, soldan sağa: altın, gümüş, bronz (daire seti)
 *   6 delik → 2 sıra x 3 sütun. Üst sıra DAİRE açıklıklı (kişi sıralaması),
 *   alt sıra KARE açıklıklı (oda sıralaması); sütunlar yine 1., 2., 3.
 *
 * ÇERÇEVE YOLU — ölçülerek kuruldu, varsayımla değil:
 *
 * 1. DELİKLERİ BUL. Kenardan taşma dolgusuyla "dışarısı" işaretleniyor; geriye
 *    kalan KAPALI boş bölgeler çerçevelerin ortasındaki dairesel açıklıklar.
 *    Üretilen sayfada üçü de şeffaf geldi, yani avatar doğrudan oradan
 *    görünecek. Ölçüm bu bölgelerin bbox'ından çıkıyor (merkez + çap).
 *
 * 2. AYIRMA ÇİZGİSİNİ DELİKLERE GÖRE GEÇ. İlk denemem "boş sütundan böl"dü ve
 *    çalışmadı: gümüş ile altının kanatları BİRBİRİNE DEĞİYOR, sayfada tek bir
 *    boş sütun yok (ölçüldü: içerik x=15..1517 aralığında kesintisiz). Aşındırma
 *    da ayırmadı (14 adıma kadar denendi, hâlâ tek parça). Bu yüzden kesim
 *    iki delik merkezinin ARASINDAKİ EN SEYREK sütundan geçiyor — kanatların
 *    en ince yerinden.
 *
 * 3. DIŞARISI ŞEFFAF. "Koyu pikseli sil" DEĞİL — o, çerçevenin kendi koyu
 *    gölgelerini de delerdi (nameplate kırpmasında öğrenilen ders). Yalnızca
 *    kenara bağlı boş bölge siliniyor.
 *
 * 4. Alan ortalamasıyla hedef genişliğe indirir, PNG yazar ve
 *    `src/podium/cerceve.ts` içindeki ÜRETİLEN bloğu ölçülerle günceller.
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const KOK = path.join(__dirname, "..");
const CIKTI_KLASOR = path.join(KOK, "assets", "podium");
const OLCU_DOSYA = path.join(KOK, "src", "podium", "cerceve.ts");
const HEDEF_GENISLIK = 520; // 3x ekranda ~170pt çerçeve için fazlasıyla yeter
const SAHNE_GENISLIK = 1080; // dikey sahnede buyutme yok (withoutEnlargement)
const VARSAYILAN_SIRA = ["altin", "gumus", "bronz"]; // sayfada soldan sağa: 1., 2., 3.
let SIRA = [...VARSAYILAN_SIRA];

/** Boş piksel: şeffaf ya da (alfasız sayfa gelirse) neredeyse siyah. */
const bosMu = (d, i) => d[i + 3] < 100 || (d[i + 3] > 200 && (d[i] + d[i + 1] + d[i + 2]) / 3 < 14);

function oku(dosya) {
  return PNG.sync.read(fs.readFileSync(dosya));
}

/** Kenardan taşma dolgusu — kenara bağlı boş bölge "dışarısı". */
function disariyiBul(png) {
  const { width: w, height: h, data: d } = png;
  const dis = new Uint8Array(w * h);
  const yigin = [];
  const koy = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (dis[i] || !bosMu(d, i * 4)) return;
    dis[i] = 1;
    yigin.push(i);
  };
  for (let x = 0; x < w; x++) { koy(x, 0); koy(x, h - 1); }
  for (let y = 0; y < h; y++) { koy(0, y); koy(w - 1, y); }
  while (yigin.length) {
    const q = yigin.pop();
    const x = q % w, y = (q - x) / w;
    koy(x + 1, y); koy(x - 1, y); koy(x, y + 1); koy(x, y - 1);
  }
  return dis;
}

/** Kapalı boş bölgeler = çerçevelerin ortasındaki açıklıklar. */
function delikleriBul(png, dis) {
  const { width: w, height: h, data: d } = png;
  const gorulen = new Uint8Array(w * h);
  const delikler = [];
  for (let s = 0; s < w * h; s++) {
    if (gorulen[s] || dis[s] || !bosMu(d, s * 4)) continue;
    const yigin = [s];
    gorulen[s] = 1;
    let n = 0, x0 = w, x1 = -1, y0 = h, y1 = -1;
    while (yigin.length) {
      const q = yigin.pop();
      const x = q % w, y = (q - x) / w;
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (a < 0 || b < 0 || a >= w || b >= h) continue;
        const r = b * w + a;
        if (gorulen[r] || dis[r] || !bosMu(d, r * 4)) continue;
        gorulen[r] = 1;
        yigin.push(r);
      }
    }
    if (n > 2000) delikler.push({ n, x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
  }
  return delikler.sort((a, b) => a.cx - b.cx);
}

/** İki delik arasındaki en seyrek sütun — kesim oradan geçiyor. */
function kesimSutunu(png, dis, solCx, sagCx, ya, yb) {
  const { width: w } = png;
  const bas = Math.round(solCx + (sagCx - solCx) * 0.2);
  const son = Math.round(solCx + (sagCx - solCx) * 0.8);
  let enIyi = bas, enAz = Infinity;
  for (let x = bas; x <= son; x++) {
    let n = 0;
    for (let y = ya; y <= yb; y++) if (!dis[y * w + x]) n++;
    if (n < enAz) { enAz = n; enIyi = x; }
  }
  return { x: enIyi, yogunluk: enAz };
}

/** İki sıra arasındaki en seyrek satır — yatay kesim oradan geçiyor. */
function kesimSatiri(png, dis, ustCy, altCy) {
  const { width: w } = png;
  const bas = Math.round(ustCy + (altCy - ustCy) * 0.2);
  const son = Math.round(ustCy + (altCy - ustCy) * 0.8);
  let enIyi = bas, enAz = Infinity;
  for (let y = bas; y <= son; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (!dis[y * w + x]) n++;
    if (n < enAz) { enAz = n; enIyi = y; }
  }
  return { y: enIyi, yogunluk: enAz };
}

/**
 * Çerçevenin GÖVDESİ — deliğin çevresinden yayılan bağlı bölge.
 *
 * Kesim çizgisini geçen komşu kanat uçları parçanın köşesinde kopuk lekeler
 * bırakıyordu (ilk turda gümüşün sağ üstünde ve bronzun sol üstünde altından
 * kopmuş turuncu tüyler çıktı). Gövde deliğin halkasından tohumlanıp bağlı
 * olan her şeyi topluyor; kopuk parçalar bağlı olmadığı için dışarıda kalıyor.
 */
function govdeyiBul(png, dis, delik, xa, xb, ya, yb) {
  const { width: w, height: h, data: d } = png;
  const govde = new Uint8Array(w * h);
  const doluMu = (i) => !dis[i] && d[i * 4 + 3] > 40;
  const yigin = [];
  const tohumla = (dx, dy) => {
    let x = Math.round(delik.cx), y = Math.round(delik.cy);
    for (let adim = 0; adim < w; adim++) {
      x += dx; y += dy;
      if (x < xa || x > xb || y < ya || y > yb) return;
      const i = y * w + x;
      if (doluMu(i)) { if (!govde[i]) { govde[i] = 1; yigin.push(i); } return; }
    }
  };
  tohumla(1, 0); tohumla(-1, 0); tohumla(0, 1); tohumla(0, -1);
  while (yigin.length) {
    const q = yigin.pop();
    const x = q % w, y = (q - x) / w;
    for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (a < xa || a > xb || b < ya || b > yb) continue;
      const r = b * w + a;
      if (govde[r] || !doluMu(r)) continue;
      govde[r] = 1;
      yigin.push(r);
    }
  }
  return govde;
}

/** Parçayı kırp, dışarısını şeffaflaştır, hedef genişliğe indir. */
function parcaHazirla(png, dis, delik, xa, xb, ya, yb) {
  const { width: w, data: d } = png;
  const govde = govdeyiBul(png, dis, delik, xa, xb, ya, yb);
  let x0 = xb, x1 = xa, y0 = yb, y1 = -1;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      if (!govde[y * w + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const pw = x1 - x0 + 1, ph = y1 - y0 + 1;
  const oran = Math.min(1, HEDEF_GENISLIK / pw);
  const nw = Math.max(1, Math.round(pw * oran));
  const nh = Math.max(1, Math.round(ph * oran));
  const cikti = new PNG({ width: nw, height: nh });

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx0 = Math.floor(x / oran), sx1 = Math.max(sx0 + 1, Math.min(pw, Math.ceil((x + 1) / oran)));
      const sy0 = Math.floor(y / oran), sy1 = Math.max(sy0 + 1, Math.min(ph, Math.ceil((y + 1) / oran)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const gx = sx + x0, gy = sy + y0;
          const i = gy * w + gx;
          // Yalnız gövde: dışarısı da, komşu çerçeveden kopan lekeler de şeffaf.
          const al = govde[i] ? d[i * 4 + 3] : 0;
          r += d[i * 4] * al; g += d[i * 4 + 1] * al; b += d[i * 4 + 2] * al;
          a += al; n++;
        }
      }
      const q = (y * nw + x) * 4;
      if (a > 0) {
        cikti.data[q] = Math.round(r / a);
        cikti.data[q + 1] = Math.round(g / a);
        cikti.data[q + 2] = Math.round(b / a);
        cikti.data[q + 3] = Math.round(a / n);
      } else {
        cikti.data[q] = cikti.data[q + 1] = cikti.data[q + 2] = cikti.data[q + 3] = 0;
      }
    }
  }

  const olcu = {
    merkezX: +(((delik.cx - x0) / pw).toFixed(4)),
    merkezY: +(((delik.cy - y0) / ph).toFixed(4)),
    capOran: +((((delik.x1 - delik.x0) + (delik.y1 - delik.y0)) / 2 / pw).toFixed(4)),
    enBoy: +((pw / ph).toFixed(4)),
  };
  return { png: cikti, olcu, pw, ph };
}

/**
 * Ölçüleri kaynağa yazar. İki ayrı işaretli blok var: daire seti (kişi) ve
 * kare seti (oda). Sayfada hangisi geldiyse yalnız o blok değişiyor, diğeri
 * olduğu gibi kalıyor — tek sıra bir sayfa gelince kare ölçüleri silinmesin.
 */
function olculeriYaz(daireSatirlari, kareSatirlari) {
  let ts = fs.readFileSync(OLCU_DOSYA, "utf8");
  const eol = ts.includes("\r\n") ? "\r\n" : "\n";

  const yaz = (basIsaret, sonIsaret, degisken, satirlar) => {
    if (!satirlar || satirlar.length === 0) return;
    const i = ts.indexOf(basIsaret), j = ts.indexOf(sonIsaret);
    if (i < 0 || j < 0) { console.error(`cerceve.ts icinde ${basIsaret} bulunamadi.`); process.exit(1); }
    const govde = [basIsaret, `const ${degisken}: Record<string, CerceveOlcu> = {`, ...satirlar, "};", ""].join(eol);
    ts = ts.slice(0, i) + govde + ts.slice(j);
  };

  yaz("/* URETILEN-BLOK-BASI */", "/* URETILEN-BLOK-SONU */", "DAIRE_OLCU", daireSatirlari);
  yaz("/* URETILEN-KARE-BLOK-BASI */", "/* URETILEN-KARE-BLOK-SONU */", "KARE_OLCU", kareSatirlari);
  fs.writeFileSync(OLCU_DOSYA, ts, "utf8");
}

/** Sahne arkaplanı: yalnız küçültme. JPEG için sharp varsa o, yoksa PNG. */
function sahneHazirla(dosya) {
  fs.mkdirSync(CIKTI_KLASOR, { recursive: true });
  let sharp = null;
  try { sharp = require("sharp"); } catch { /* yok */ }
  if (sharp) {
    const hedef = path.join(CIKTI_KLASOR, "sahne.jpg");
    return sharp(dosya)
      .resize({ width: SAHNE_GENISLIK, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(hedef)
      .then(() => console.log(`sahne.jpg yazildi — ${(fs.statSync(hedef).size / 1024).toFixed(0)} KB`));
  }
  console.warn("sharp bulunamadi; sahne PNG olarak yazilacak (daha buyuk).");
  const png = oku(dosya);
  const hedef = path.join(CIKTI_KLASOR, "sahne.png");
  fs.writeFileSync(hedef, PNG.sync.write(png));
  console.log(`sahne.png yazildi — ${(fs.statSync(hedef).size / 1024).toFixed(0)} KB`);
}

/** Delikleri satırlara böler: 3 delik → tek sıra, 6 delik → 2x3. */
function izgarayaBol(delikler, yukseklik) {
  if (delikler.length === 3) return [[...delikler].sort((a, b) => a.cx - b.cx)];
  const sirali = [...delikler].sort((a, b) => a.cy - b.cy);
  const ust = sirali.slice(0, 3).sort((a, b) => a.cx - b.cx);
  const alt = sirali.slice(3).sort((a, b) => a.cx - b.cx);
  // Sağlama: iki sıranın arası, sıra içi dağılımdan belirgin biçimde büyük olmalı.
  const ara = Math.min(...alt.map((d) => d.cy)) - Math.max(...ust.map((d) => d.cy));
  if (ara < yukseklik * 0.12) {
      console.error("HATA: alti delik bulundu ama iki ayri SIRA ayirt edilemedi.");
      console.error("Sayfada ust ve alt siranin arasinda genis bos bir serit olmali.");
      process.exit(1);
  }
  return [ust, alt];
}

function main() {
  const arg = process.argv.slice(2);
  if (arg.length === 0) {
    console.error("Kullanim: node scripts/cerceve-hazirla.js <sayfa.png>   (3 ya da 6 cerceveli sayfa)");
    console.error("     ya da: node scripts/cerceve-hazirla.js --sahne <arkaplan.png>");
    process.exit(1);
  }
  if (arg[0] === "--sahne") { sahneHazirla(arg[1]); return; }

  // Sayfadaki dizilim farkliysa: --sira gumus,altin,bronz
  const siraIx = arg.indexOf("--sira");
  if (siraIx >= 0) {
    SIRA = arg[siraIx + 1].split(",").map((x) => x.trim());
    arg.splice(siraIx, 2);
    console.log("Dizilim:", SIRA.join(" | "));
  }

  fs.mkdirSync(CIKTI_KLASOR, { recursive: true });
  const png = oku(arg[0]);
  const dis = disariyiBul(png);
  const delikler = delikleriBul(png, dis);
  if (delikler.length !== 3 && delikler.length !== 6) {
    console.error(`HATA: ${delikler.length} adet orta aciklik bulundu, 3 ya da 6 bekleniyordu.`);
    console.error("Model cercevelerin ortasini doldurmus olabilir; 'the center opening must be completely empty and transparent' diye tekrarlat.");
    process.exit(1);
  }

  const siralar = izgarayaBol(delikler, png.height);
  console.log(`${delikler.length} aciklik, ${siralar.length} sira`);

  // Sıralar arası yatay kesim (yalnız iki sıralı sayfada).
  const ySinir = [0];
  if (siralar.length === 2) {
    const ustCy = Math.max(...siralar[0].map((d) => d.cy));
    const altCy = Math.min(...siralar[1].map((d) => d.cy));
    const k = kesimSatiri(png, dis, ustCy, altCy);
    console.log(`yatay kesim: y=${k.y} (o satirda ${k.yogunluk} dolu piksel)`);
    ySinir.push(k.y);
  }
  ySinir.push(png.height - 1);

  const sonuc = {};
  siralar.forEach((sira, si) => {
    const ya = si === 0 ? ySinir[0] : ySinir[si] + 1;
    const yb = ySinir[si + 1];
    // Sütun kesimleri o sıranın y bandına göre ölçülüyor.
    const xSinir = [0];
    for (let i = 0; i < 2; i++) {
      const k = kesimSutunu(png, dis, sira[i].cx, sira[i + 1].cx, ya, yb);
      console.log(`sira ${si + 1} kesim ${i + 1}: x=${k.x} (${k.yogunluk} dolu piksel)`);
      xSinir.push(k.x);
    }
    xSinir.push(png.width - 1);

    sira.forEach((delik, i) => {
      const kod = (si === 1 ? "kare-" : "") + SIRA[i];
      const xa = i === 0 ? xSinir[0] : xSinir[i] + 1;
      const xb = xSinir[i + 1];
      sonuc[kod] = parcaHazirla(png, dis, delik, xa, xb, ya, yb);
    });
  });

  /**
   * WEBP, PNG DEĞİL. Aynı üç çerçeve PNG olarak 1.027 KB, WebP q92 olarak
   * 291 KB tutuyor — 736 KB fark ve gözle ayırt edilebilir bir kayıp yok.
   * Hediye tarafında bundle 10 MB'tan 6 MB'a indirilmişti; aynı disiplin.
   */
  let sharp;
  try { sharp = require("sharp"); } catch {
    console.error("HATA: sharp bulunamadi. Cerceveler WebP olarak yaziliyor; once 'npm i -D sharp'.");
    process.exit(1);
  }

  const kodlar = Object.keys(sonuc);
  const isler = kodlar.map(async (kod) => {
    const p = sonuc[kod];
    const hedef = path.join(CIKTI_KLASOR, `cerceve-${kod}.webp`);
    await sharp(Buffer.from(p.png.data), { raw: { width: p.png.width, height: p.png.height, channels: 4 } })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(hedef);
    const kb = (fs.statSync(hedef).size / 1024).toFixed(0);
    console.log(`${kod}: ${p.png.width}x${p.png.height}  ${kb} KB  delik ${p.olcu.merkezX}/${p.olcu.merkezY} cap ${p.olcu.capOran} enboy ${p.olcu.enBoy}`);
  });

  Promise.all(isler).then(() => {
    const satir = (kod) => {
      const o = sonuc[kod].olcu;
      const ad = kod.includes("-") ? `"${kod}"` : kod;
      return `  ${ad}: { merkezX: ${o.merkezX}, merkezY: ${o.merkezY}, capOran: ${o.capOran}, enBoy: ${o.enBoy} },`;
    };
    const daire = kodlar.filter((k) => !k.startsWith("kare-")).map(satir);
    const kare = kodlar.filter((k) => k.startsWith("kare-")).map(satir);
    olculeriYaz(daire, kare);
    console.log("\nOlculer yazildi:", path.relative(KOK, OLCU_DOSYA));
    if (kare.length) {
      console.log("SON ADIM: src/podium/cerceve.ts icinde kare require satirlarinin yorumunu kaldir ve KARE_HAZIR = true yap.");
    }
  });
}
main();
