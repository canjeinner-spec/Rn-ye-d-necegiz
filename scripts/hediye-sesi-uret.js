#!/usr/bin/env node
/**
 * Hediye seslerini URETIR (indirmez) — assets/gifts/*.wav
 *
 * NEDEN URETIM, INDIRME DEGIL:
 *   1) Indirilen bir dosyayi dinleyemiyorum; yalnizca dosya adina bakarak
 *      secmek olurdu ve "magic-sparkle.wav" ne oldugu belirsiz bir sey.
 *   2) Uygulama markete cikacak. Uretilen ses tamamen bize ait; lisans
 *      takibi ve atif yukumlulugu yok.
 *   3) Her ses burada birkac sayiyla tarif ediliyor. Begenilmeyeni
 *      degistirmek tek satir, yeniden dosya aramak degil.
 *
 * BICIM: 44100 Hz, mono, 16-bit PCM — mevcut legendary.wav ile ayni.
 *
 * KULLANIM:
 *   node scripts/hediye-sesi-uret.js            # hepsini uret
 *   node scripts/hediye-sesi-uret.js gul noel   # yalniz bunlari
 */
const fs = require("fs");
const path = require("path");

const HZ = 44100;
const HEDEF = path.join(__dirname, "..", "assets", "gifts");

// ── Kucuk DSP takimi ───────────────────────────────────────────────────────

const bos = (saniye) => new Float32Array(Math.ceil(saniye * HZ));

/** Ustel sonumleme zarfi. `atak` hoparlorde tiklama sesini onluyor. */
function zarf(uzunluk, atak, sonum) {
  const a = Math.max(1, Math.floor(atak * HZ));
  return (i) => (i < a ? i / a : Math.exp(-(i - a) / (sonum * HZ)));
}

function ekle(hedef, kaynak, gecikmeSn, kazanc) {
  const off = Math.floor(gecikmeSn * HZ);
  for (let i = 0; i < kaynak.length; i++) {
    const j = off + i;
    if (j >= 0 && j < hedef.length) hedef[j] += kaynak[i] * kazanc;
  }
}

/**
 * Cam/zil tinisi: birbirine tam kat olmayan (inharmonik) kismi seslerin
 * toplami. Bir zilin piyanodan farkli duyulmasinin sebebi budur — kismi
 * sesler 2x, 3x degil 2.76x, 5.40x gibi oranlarda oturur.
 */
function zil(frekans, sure, kismilar) {
  const x = bos(sure);
  for (let k = 0; k < kismilar.length; k++) {
    const oran = kismilar[k][0], agirlik = kismilar[k][1], sonumOrani = kismilar[k][2];
    const z = zarf(x.length, 0.002, sure * sonumOrani);
    const w = (2 * Math.PI * frekans * oran) / HZ;
    for (let i = 0; i < x.length; i++) x[i] += Math.sin(w * i) * z(i) * agirlik;
  }
  return x;
}

/** Telli calgi tinisi: temel + birkac harmonik, hizli atak. */
function tel(frekans, sure) {
  return zil(frekans, sure, [[1, 1, 1], [2, 0.34, 0.6], [3, 0.14, 0.42], [4.02, 0.06, 0.3]]);
}

/** Durum degiskenli suzgec — gurultuye ton kazandirmak icin bant gecirgen. */
function bantGecirgen(giris, merkez, q) {
  const cikis = new Float32Array(giris.length);
  const f = 2 * Math.sin((Math.PI * merkez) / HZ);
  let alcak = 0, bant = 0;
  for (let i = 0; i < giris.length; i++) {
    const yuksek = giris[i] - alcak - q * bant;
    bant += f * yuksek;
    alcak += f * bant;
    cikis[i] = bant;
  }
  return cikis;
}

function gurultu(sure, atak, sonum) {
  const x = bos(sure);
  const z = zarf(x.length, atak, sonum);
  for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * z(i);
  return x;
}

/** Frekansi zamanla kayan sinus — kaplanin kukremesi icin. */
function suzulme(bas, son, sure, atak, sonum) {
  const x = bos(sure);
  const z = zarf(x.length, atak, sonum);
  let faz = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / x.length;
    faz += (2 * Math.PI * (bas + (son - bas) * t)) / HZ;
    x[i] = Math.sin(faz) * z(i);
  }
  return x;
}

/** Yumusak kirpma: tepeleri sert kesmeden sicaklik verir. */
const yumusakKirp = (v) => Math.tanh(v * 1.15);

function bitir(x) {
  let tepe = 0;
  for (let i = 0; i < x.length; i++) tepe = Math.max(tepe, Math.abs(x[i]));
  const olcek = tepe > 0 ? 0.89 / tepe : 1;
  const sonuc = new Float32Array(x.length);
  // Bas ve sonda 6 ms silinme: hoparlorde "tik" sesini onler.
  const kenar = Math.floor(0.006 * HZ);
  for (let i = 0; i < x.length; i++) {
    let g = 1;
    if (i < kenar) g = i / kenar;
    else if (i > x.length - kenar) g = (x.length - i) / kenar;
    sonuc[i] = yumusakKirp(x[i] * olcek) * g;
  }
  return sonuc;
}

function wavYaz(yol, ornekler) {
  const veri = Buffer.alloc(ornekler.length * 2);
  for (let i = 0; i < ornekler.length; i++) {
    const v = Math.max(-1, Math.min(1, ornekler[i]));
    veri.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const bas = Buffer.alloc(44);
  bas.write("RIFF", 0);
  bas.writeUInt32LE(36 + veri.length, 4);
  bas.write("WAVE", 8);
  bas.write("fmt ", 12);
  bas.writeUInt32LE(16, 16);
  bas.writeUInt16LE(1, 20);   // PCM
  bas.writeUInt16LE(1, 22);   // mono
  bas.writeUInt32LE(HZ, 24);
  bas.writeUInt32LE(HZ * 2, 28);
  bas.writeUInt16LE(2, 32);
  bas.writeUInt16LE(16, 34);
  bas.write("data", 36);
  bas.writeUInt32LE(veri.length, 40);
  fs.writeFileSync(yol, Buffer.concat([bas, veri]));
}

// Nota adindan frekans (A4 = 440 Hz).
const NOTALAR = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };
function nota(ad) {
  const yarim = ad.indexOf("#") > 0;
  const harf = ad.slice(0, yarim ? 2 : 1);
  const oktav = parseInt(ad.slice(yarim ? 2 : 1), 10);
  const yariTon = NOTALAR[harf] + (oktav - 4) * 12;
  return 440 * Math.pow(2, yariTon / 12);
}

// ── Hediye sesleri ─────────────────────────────────────────────────────────

const ZIL_KISMI = [[1, 1, 1], [2.76, 0.42, 0.55], [5.40, 0.2, 0.34], [8.93, 0.09, 0.22]];

const SESLER = {
  /** Gul — yumusak arp arpeji, romantik ve sakin. */
  gul() {
    const x = bos(1.9);
    ["A4", "C#5", "E5", "A5", "C#6"].forEach((n, i) => {
      ekle(x, tel(nota(n), 1.3), i * 0.085, 0.85 - i * 0.07);
    });
    return x;
  },

  /** Asik Kedi — oyuncu iki nota, sonda kucuk bir pirilti. */
  kedi() {
    const x = bos(1.3);
    ekle(x, tel(nota("E5"), 0.4), 0.0, 0.9);
    ekle(x, tel(nota("A5"), 0.45), 0.12, 0.9);
    ["E6", "A6", "C#7"].forEach((n, i) => ekle(x, zil(nota(n), 0.5, ZIL_KISMI), 0.34 + i * 0.06, 0.3));
    return x;
  },

  /** Sansli Ayicik — muzik kutusu ezgisi. */
  ayicik() {
    const x = bos(2.1);
    ["C5", "E5", "G5", "E5", "C6"].forEach((n, i) => {
      ekle(x, zil(nota(n), 1.0, ZIL_KISMI), i * 0.135, 0.8);
    });
    return x;
  },

  /** Tavsan Cifti — birlikte calan iki can (besli aralik = cift) + pirilti. */
  tavsan() {
    const x = bos(1.8);
    ekle(x, zil(nota("D5"), 1.2, ZIL_KISMI), 0, 0.75);
    ekle(x, zil(nota("A5"), 1.2, ZIL_KISMI), 0.02, 0.7);
    ["D6", "F#6", "A6", "D7"].forEach((n, i) => ekle(x, zil(nota(n), 0.6, ZIL_KISMI), 0.4 + i * 0.07, 0.26));
    return x;
  },

  /** Kukreyen Kaplan — alcak kukreme + gurultu gumburtusu + ilk vurus. */
  kaplan() {
    const x = bos(1.9);
    ekle(x, suzulme(150, 58, 1.5, 0.02, 0.55), 0.02, 0.9);
    ekle(x, suzulme(300, 116, 1.4, 0.02, 0.45), 0.02, 0.35);
    ekle(x, bantGecirgen(gurultu(1.4, 0.05, 0.5), 420, 0.55), 0.03, 0.55);
    ekle(x, suzulme(180, 40, 0.2, 0.001, 0.06), 0, 0.8);
    return x;
  },

  /**
   * Noel Baba — kizak canlari. Kizak cani aslinda dar bantta suzulmus kisa
   * gurultu patlamalaridir; ritmi de hafif duzensiz olmali, makine gibi
   * durmasin diye her patlama birkac milisaniye kaydiriliyor.
   */
  noel() {
    const x = bos(2.4);
    const ritim = [0, 0.16, 0.3, 0.46, 0.62, 0.75, 0.92, 1.06, 1.22, 1.38];
    ritim.forEach((t, i) => {
      const patlama = bantGecirgen(gurultu(0.34, 0.001, 0.09), 3600 + (i % 3) * 700, 0.28);
      ekle(x, patlama, t + Math.sin(i * 12.9898) * 0.008, i % 2 ? 0.5 : 0.72);
    });
    ["G4", "B4", "D5"].forEach((n) => ekle(x, zil(nota(n), 1.8, ZIL_KISMI), 0.02, 0.32));
    return x;
  },

  /** Hazine Sandigi — sandik kapagi, ardindan altin sikirtisi. */
  hazine() {
    const x = bos(2.3);
    ekle(x, suzulme(140, 52, 0.28, 0.001, 0.08), 0, 0.8);
    ekle(x, bantGecirgen(gurultu(0.3, 0.001, 0.07), 900, 0.7), 0, 0.45);
    for (let i = 0; i < 16; i++) {
      const f = 1500 + Math.random() * 2600;
      ekle(x, zil(f, 0.55, ZIL_KISMI), 0.18 + i * 0.055 + Math.random() * 0.03, 0.16 + (i / 16) * 0.14);
    }
    ["C6", "E6", "G6"].forEach((n, i) => ekle(x, zil(nota(n), 1.1, ZIL_KISMI), 1.0 + i * 0.05, 0.3));
    return x;
  },
};

const istenen = process.argv.slice(2).filter((a) => a.indexOf("--") !== 0);
const liste = istenen.length ? istenen : Object.keys(SESLER);
fs.mkdirSync(HEDEF, { recursive: true });

for (const ad of liste) {
  if (!SESLER[ad]) { console.error("  " + ad + " — tanimli degil"); continue; }
  const ornekler = bitir(SESLER[ad]());
  const yol = path.join(HEDEF, ad + ".wav");
  wavYaz(yol, ornekler);
  console.log("  " + ad.padEnd(8) + (ornekler.length / HZ).toFixed(2) + " sn  " +
    (fs.statSync(yol).size / 1024).toFixed(0).padStart(4) + " KB");
}
console.log("");
console.log(liste.length + " ses -> assets/gifts/");
