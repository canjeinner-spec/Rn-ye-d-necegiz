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

/** Tek kutuplu alcak gecirgen — tizleri kisar, sesi kalinlastirir. */
function alcakGecirgen(giris, kesim) {
  const y = new Float32Array(giris.length);
  const a = 1 - Math.exp((-2 * Math.PI * kesim) / HZ);
  let onceki = 0;
  for (let i = 0; i < giris.length; i++) {
    onceki += a * (giris[i] - onceki);
    y[i] = onceki;
  }
  return y;
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

// ── Ses teli sentezi (kaynak-suzgec modeli) ────────────────────────────────
//
// Miyav, kukreme ve kahkaha SINUS VE GURULTUYLE YAPILAMAZ. Bunlar ses teli
// sesidir ve iki parcadan olusur:
//   KAYNAK  — ses tellerinin urettigi darbe dizisi (perde = f0).
//   SUZGEC  — agiz ve bogaz bosluklarinin rezonanslari (FORMANTLAR). Bir
//             sesi "a" ya da "o" yapan sey perde degil, bu rezonanslarin
//             frekansidir.
// Konusan/miyavlayan bir sesin sirri formantlarin ZAMAN ICINDE KAYMASI:
// "miyav" derken agiz acilip kapaniyor, F1 ve F2 birlikte suzuluyor.

/**
 * Ses teli darbesi (Rosenberg benzeri): yumusak yukselis, hizli dusus.
 * `titrek` perdeye kucuk rastgele sapma katar — tam duzgun perde robot gibi
 * duyulur; canlilar hicbir zaman tam duzgun degildir.
 * `nefes` darbeye gurultu karistirir (h sesi, hirilti, kukremedeki catallik).
 */
function sesTeli(sure, perdeEgrisi, titrek, nefes) {
  const x = bos(sure);
  let faz = 0;
  const yukselis = 0.4, dusus = 0.16;
  for (let i = 0; i < x.length; i++) {
    const t = i / x.length;
    const f0 = perdeEgrisi(t) * (1 + (Math.random() * 2 - 1) * titrek);
    faz += f0 / HZ;
    if (faz >= 1) faz -= 1;
    let v;
    if (faz < yukselis) { const u = faz / yukselis; v = 3 * u * u - 2 * u * u * u; }
    else if (faz < yukselis + dusus) { const u = (faz - yukselis) / dusus; v = 1 - u * u; }
    else v = 0;
    const n = typeof nefes === "function" ? nefes(t) : nefes;
    x[i] = (v - 0.45) * 2 * (1 - n) + (Math.random() * 2 - 1) * n;
  }
  return x;
}

/**
 * Zamanla kayan formant rezonansi (iki kutuplu suzgec).
 * Katsayilar her ornekte yeniden hesaplaniyor; formantlar yavas degistigi
 * icin bu kararli ve "kayan agiz" etkisini veren sey tam olarak bu.
 */
function formant(giris, frekansEgrisi, bant) {
  const y = new Float32Array(giris.length);
  let y1 = 0, y2 = 0;
  const r = Math.exp((-Math.PI * bant) / HZ);
  for (let i = 0; i < giris.length; i++) {
    const t = i / giris.length;
    const F = typeof frekansEgrisi === "function" ? frekansEgrisi(t) : frekansEgrisi;
    const th = (2 * Math.PI * F) / HZ;
    const a1 = 2 * r * Math.cos(th), a2 = -(r * r);
    const g = (1 - r) * Math.sqrt(Math.max(0, 1 - 2 * r * Math.cos(2 * th) + r * r));
    const v = g * giris[i] + a1 * y1 + a2 * y2;
    y[i] = v; y2 = y1; y1 = v;
  }
  return y;
}

/** Birden cok formanti paralel toplar — sesli harfi olusturan sey budur. */
function agiz(kaynak, formantlar) {
  const y = new Float32Array(kaynak.length);
  for (const [F, B, k] of formantlar) {
    const f = formant(kaynak, F, B);
    for (let i = 0; i < y.length; i++) y[i] += f[i] * k;
  }
  return y;
}

/** Iki nokta arasinda dogrusal gecis — perde ve formant egrileri icin. */
function egri(noktalar) {
  return (t) => {
    for (let i = 1; i < noktalar.length; i++) {
      if (t <= noktalar[i][0]) {
        const [t0, v0] = noktalar[i - 1], [t1, v1] = noktalar[i];
        const u = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * u;
      }
    }
    return noktalar[noktalar.length - 1][1];
  };
}

/** DC kaymasini temizler — darbe dizisi simetrik degil, birikirse boguklasir. */
function dcSil(x) {
  let ort = 0;
  for (let i = 0; i < x.length; i++) ort += x[i];
  ort /= x.length;
  for (let i = 0; i < x.length; i++) x[i] -= ort;
  return x;
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

  /**
   * Asik Kedi — GERCEK MIYAV.
   *
   * Kedi miyavi iki seyin birlesimi: yuksek ve BUKULEN bir perde (560 ->
   * 1020 -> 480 Hz) ve agzin acilip kapanmasiyla KAYAN formantlar.
   * "mi-ya-uv" hecelerinin karsiligi: baslangicta agiz kapali (m, alcak F1),
   * ortada tam acik (a, F1 900'e cikar), sonda buzulup kapaniyor (u, F1 ve
   * F2 birlikte duser). Bu kaymayi yapmazsan sadece tiz bir dudugun olur.
   */
  kedi() {
    const sure = 0.85;
    const perde = egri([[0, 560], [0.25, 1020], [0.55, 900], [1, 480]]);
    const nefes = egri([[0, 0.05], [0.8, 0.06], [1, 0.25]]);
    const kaynak = dcSil(sesTeli(sure, perde, 0.012, nefes));
    const F1 = egri([[0, 300], [0.12, 520], [0.40, 900], [0.70, 620], [1, 420]]);
    const F2 = egri([[0, 1100], [0.12, 1900], [0.40, 1500], [0.70, 1050], [1, 850]]);
    const s = agiz(kaynak, [[F1, 90, 1], [F2, 120, 0.55], [2800, 220, 0.18]]);
    const genlik = egri([[0, 0.25], [0.14, 1], [0.72, 0.9], [1, 0]]);
    const x = bos(sure);
    for (let i = 0; i < x.length; i++) x[i] = s[i] * genlik(i / x.length);
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

  /**
   * Kukreyen Kaplan — GERCEK KUKREME.
   *
   * Kukreme de ses telidir, ama iki farkla: perde cok alcak (105 -> 52 Hz)
   * ve TITREKLIK yuksek (0.055). O titreklik kukremenin catallik ve
   * kabaligini veren sey — duzgun perdeyle sadece bir korna cikardi.
   * Ustune 28 Hz genlik dalgalanmasi geliyor: gogusten gelen gumburtu.
   * Nefes payi basta ve sonda yuksek (hirilti), ortada dusuk (ton).
   */
  kaplan() {
    const sure = 1.9;
    const perde = egri([[0, 105], [0.25, 78], [0.7, 62], [1, 52]]);
    // NEFES VE TITREKLIK OLCUMLE DUSURULDU. Ilk denemede nefes 0.3-0.6 ve
    // titreklik 0.055'ti; `scripts/ses-incele.js` sonucu: perde hic
    // okunamiyor ve parlaklik 1803 Hz. Yani hirilti asil sesi bastirmis,
    // kukreme degil tislama cikiyordu. Bir kukremenin agirligi 600 Hz'in
    // altinda olmali.
    const nefes = egri([[0, 0.26], [0.2, 0.1], [0.75, 0.13], [1, 0.32]]);
    const kaynak = dcSil(sesTeli(sure, perde, 0.028, nefes));
    const F1 = egri([[0, 420], [0.4, 560], [1, 480]]);
    const F2 = egri([[0, 1000], [0.4, 1250], [1, 1050]]);
    const s = alcakGecirgen(agiz(kaynak, [[F1, 130, 1], [F2, 200, 0.26], [2500, 400, 0.04]]), 850);
    const genlik = egri([[0, 0], [0.12, 1], [0.62, 0.95], [1, 0]]);
    const x = bos(sure);
    for (let i = 0; i < x.length; i++) {
      x[i] = s[i] * genlik(i / x.length) * (0.85 + 0.15 * Math.sin((2 * Math.PI * 28 * i) / HZ));
    }
    ekle(x, suzulme(70, 45, 1.5, 0.05, 0.6), 0.02, 0.35); // gogus rezonansi
    return x;
  },

  /**
   * Noel Baba — kizak canlari. Kizak cani aslinda dar bantta suzulmus kisa
   * gurultu patlamalaridir; ritmi de hafif duzensiz olmali, makine gibi
   * durmasin diye her patlama birkac milisaniye kaydiriliyor.
   */
  noel() {
    const x = bos(2.9);

    // "HO HO HO" — her hece dusen perdeli bir /o/. Kahkahayi kahkaha yapan
    // sey perdenin her hecede DUSMESI ve hecelerin giderek alcalmasi.
    // Bastaki "h" nefes payinin yuksek baslayip hemen dusmesiyle olusuyor.
    // /o/ sesli harfi: F1 ve F2 birbirine yakin ve alcak — yuvarlak, kalin.
    [0, 0.36, 0.7].forEach((t, i) => {
      const sure = 0.3;
      const perde = egri([[0, 132 - i * 8], [1, 96 - i * 6]]);
      const nefes = egri([[0, 0.75], [0.18, 0.1], [1, 0.22]]);
      const kaynak = dcSil(sesTeli(sure, perde, 0.02, nefes));
      const s = agiz(kaynak, [
        [egri([[0, 460], [1, 420]]), 80, 1],
        [egri([[0, 820], [1, 760]]), 100, 0.6],
        [2500, 220, 0.12],
      ]);
      const genlik = egri([[0, 0], [0.08, 1], [0.55, 0.8], [1, 0]]);
      const b = bos(sure);
      for (let k = 0; k < b.length; k++) b[k] = s[k] * genlik(k / b.length);
      ekle(x, b, t, 1);
    });

    // Ardindan kizak canlari: dar bantta suzulmus kisa gurultu patlamalari.
    // Ritim kasten hafif duzensiz, makine gibi durmasin.
    [1.05, 1.2, 1.33, 1.49, 1.64, 1.78, 1.94, 2.08].forEach((t, i) => {
      const patlama = bantGecirgen(gurultu(0.34, 0.001, 0.09), 3600 + (i % 3) * 700, 0.28);
      ekle(x, patlama, t + Math.sin(i * 12.9898) * 0.008, i % 2 ? 0.34 : 0.48);
    });
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
