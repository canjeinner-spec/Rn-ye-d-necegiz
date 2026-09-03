#!/usr/bin/env node
/**
 * Uretilen WAV dosyasini OLCER — perde egrisi, enerji yapisi, tiz agirligi.
 *
 * NEDEN VAR: sesleri dinleyemiyorum. "Kedi miyavliyor" demek yerine
 * olcup gostermek gerekiyor: miyavin perdesi yukselip dusmeli, kukremenin
 * perdesi cok alcak ve titrek olmali, "ho ho ho" UC ayri enerji patlamasi
 * olarak gorunmeli. Bunlar dosyadan dogrulanabilir.
 *
 * KULLANIM:
 *   node scripts/ses-incele.js assets/gifts/kedi.wav
 *   node scripts/ses-incele.js assets/gifts/*.wav
 */
const fs = require("fs");
const path = require("path");

function wavOku(yol) {
  const b = fs.readFileSync(yol);
  const hz = b.readUInt32LE(24);
  const n = (b.length - 44) / 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
  return { x, hz };
}

/** Otokorelasyonla perde kestirimi. Perde yoksa (gurultu/can) 0 doner. */
function perde(x, bas, uzunluk, hz) {
  const enAlcak = 45, enYuksek = 1400;
  const gecikmeMin = Math.floor(hz / enYuksek);
  const gecikmeMax = Math.floor(hz / enAlcak);
  // NORMALIZE EDILMIS capraz korelasyon. Ilk surum toplami sabit bir enerjiye
  // boluyordu; uzun gecikmelerde ortusen bolge kisaldigi icin deger kendi
  // basina dusuyor ve dedektor KISA GECIKMELERI kayiriyordu. Kaplanin
  // 52-105 Hz perdesi bu yuzden hic gorulmedi, hep 1423 Hz (en kisa gecikme)
  // okundu. Her gecikmede kendi ortusen bolgesinin enerjisine bolmek sart.
  let enIyi = 0, enIyiDeger = 0;
  let toplamEnerji = 0;
  for (let i = 0; i < uzunluk; i++) toplamEnerji += x[bas + i] * x[bas + i];
  if (toplamEnerji < 1e-6) return 0;
  for (let g = gecikmeMin; g <= gecikmeMax; g++) {
    let carpim = 0, e1 = 0, e2 = 0;
    for (let i = 0; i + g < uzunluk; i++) {
      const a = x[bas + i], b = x[bas + i + g];
      carpim += a * b; e1 += a * a; e2 += b * b;
    }
    if (e1 < 1e-9 || e2 < 1e-9) continue;
    const d = carpim / Math.sqrt(e1 * e2);
    if (d > enIyiDeger) { enIyiDeger = d; enIyi = g; }
  }
  // 0.3 esigi: bunun altinda periyodik bir yapi yok demektir.
  return enIyiDeger > 0.3 ? hz / enIyi : 0;
}

/** Spektral agirlik merkezi — sesin "parlakligi". Zil yuksek, kukreme alcak. */
function agirlikMerkezi(x, bas, uzunluk, hz) {
  const N = 1024;
  if (bas + N > x.length) return 0;
  // HANN PENCERESI SART. Ilk surumde pencereleme yoktu ve dikdortgen
  // pencerenin spektral sizintisi tizleri sisiriyordu: kaplan icin 1958 Hz
  // "parlaklik" okunmustu, oysa sesin agirligi cok daha alcakta. Olcum
  // aracina guvenmeden ses ayarlamak yanlis yeri kovalamak olur.
  const pen = new Float32Array(N);
  for (let i = 0; i < N; i++) pen[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

  let ustToplam = 0, altToplam = 0;
  for (let k = 1; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * k * i) / N;
      const v = x[bas + i] * pen[i];
      re += v * Math.cos(a);
      im -= v * Math.sin(a);
    }
    const guc = Math.sqrt(re * re + im * im);
    ustToplam += ((k * hz) / N) * guc;
    altToplam += guc;
  }
  return altToplam > 0 ? ustToplam / altToplam : 0;
}

for (const yol of process.argv.slice(2)) {
  const { x, hz } = wavOku(yol);
  const pencere = Math.floor(hz * 0.04);
  const adim = Math.floor(hz * 0.05);
  console.log("── " + path.basename(yol) + "  " + (x.length / hz).toFixed(2) + " sn");

  // Enerji zarfi (20 dilim) — patlama yapisini gosterir.
  const dilim = 20;
  let cizgi = "";
  const enerjiler = [];
  for (let d = 0; d < dilim; d++) {
    const b = Math.floor((d * x.length) / dilim);
    const s = Math.floor(x.length / dilim);
    let kare = 0;
    for (let i = 0; i < s; i++) kare += x[b + i] * x[b + i];
    enerjiler.push(Math.sqrt(kare / s));
  }
  const enBuyuk = Math.max(...enerjiler);
  for (const e of enerjiler) {
    const oran = enBuyuk > 0 ? e / enBuyuk : 0;
    cizgi += " .:-=+*#%@"[Math.min(9, Math.floor(oran * 9.99))];
  }
  console.log("   enerji  [" + cizgi + "]");

  // Perde egrisi.
  const perdeler = [];
  for (let b = 0; b + pencere < x.length; b += adim) {
    const p = perde(x, b, pencere, hz);
    perdeler.push(p > 0 ? Math.round(p) : 0);
  }
  console.log("   perde   " + perdeler.map((p) => (p ? String(p) : "-")).join(" ") + "  Hz");
  const sesli = perdeler.filter((p) => p > 0);
  if (sesli.length) {
    console.log("   perde araligi: " + Math.min(...sesli) + " - " + Math.max(...sesli) + " Hz");
  }
  console.log("   parlaklik: " + Math.round(agirlikMerkezi(x, Math.floor(x.length * 0.3), 1024, hz)) + " Hz");
  console.log("");
}
