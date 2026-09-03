#!/usr/bin/env node
/**
 * lottie-boya.js — Lottie JSON dosyasindaki renkleri toplu degistirir.
 *
 * NEDEN: LottieFiles'tan indirilen bedava dosyalar acik tema icin cizilmis
 * oluyor (siyah kontur, beyaz dolgu, canli vurgu). Aron Chat'in zemini
 * #08080C; siyah kontur o zeminde TAMAMEN kayboluyor. Dosyayi elle acip
 * duzenlemek yerine renkleri burada esliyoruz.
 *
 * KULLANIM
 *   Once dosyada hangi renkler var gor:
 *     node scripts/lottie-boya.js --liste girdi.json
 *
 *   Sonra esleyip yaz (eski=yeni, # opsiyonel, buyuk/kucuk harf farketmez):
 *     node scripts/lottie-boya.js girdi.json cikti.json 000000=8E8C99 FFFFFF=131319
 *
 * NE OKUR: dolgu (fl), kontur (st), gradyan (gf/gs) duraklari ve
 * zemin katmani (ty:1) rengi. Animasyonlu renk (a:1) varsa UYARIR ve
 * dokunmaz — o dosyayi elle bakmak gerekir.
 */
const fs = require("fs");

const cevir = (a) =>
  "#" + [0, 1, 2].map((i) => Math.round((a[i] || 0) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const coz = (h) => {
  const s = h.replace(/^#/, "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};

/** Agacta renk tasiyan her dugume `is(hex)` uygular; donen hex ile gunceller. */
function gez(o, is, uyari) {
  if (Array.isArray(o)) { o.forEach((x) => gez(x, is, uyari)); return; }
  if (!o || typeof o !== "object") return;

  if ((o.ty === "fl" || o.ty === "st") && o.c) {
    if (o.c.a === 1) uyari.push(`animasyonlu renk atlandi: ${o.nm || "?"}`);
    else if (Array.isArray(o.c.k) && o.c.k.every((x) => typeof x === "number")) {
      const yeni = is(cevir(o.c.k));
      if (yeni) { const r = coz(yeni); o.c.k[0] = r[0]; o.c.k[1] = r[1]; o.c.k[2] = r[2]; }
    }
  }
  // Gradyan duraklari: k.k = [konum, r, g, b, konum, r, g, b, ...]
  if ((o.ty === "gf" || o.ty === "gs") && o.g && o.g.k && Array.isArray(o.g.k.k)) {
    const k = o.g.k.k, n = o.g.p || Math.floor(k.length / 4);
    for (let i = 0; i < n; i++) {
      const b = i * 4;
      const yeni = is(cevir([k[b + 1], k[b + 2], k[b + 3]]));
      if (yeni) { const r = coz(yeni); k[b + 1] = r[0]; k[b + 2] = r[1]; k[b + 3] = r[2]; }
    }
  }
  if (o.ty === 1 && typeof o.sc === "string") {
    const yeni = is(o.sc.toUpperCase());
    if (yeni) o.sc = yeni;
  }
  for (const anahtar of Object.keys(o)) gez(o[anahtar], is, uyari);
}

const arg = process.argv.slice(2);

if (arg[0] === "--liste") {
  const j = JSON.parse(fs.readFileSync(arg[1], "utf8"));
  const say = new Map(), uyari = [];
  gez(j.layers, (h) => { say.set(h, (say.get(h) || 0) + 1); return null; }, uyari);
  console.log(`${arg[1]}  ${j.w}x${j.h}  ${((j.op - j.ip) / j.fr).toFixed(2)}sn  ${(j.assets || []).length} varlik`);
  [...say.entries()].sort((a, b) => b[1] - a[1]).forEach(([h, n]) => console.log(`  ${h}  ${String(n).padStart(3)} yer`));
  uyari.forEach((u) => console.log("  UYARI:", u));
  process.exit(0);
}

const [girdi, cikti, ...eslesmeler] = arg;
if (!girdi || !cikti || eslesmeler.length === 0) {
  console.error("kullanim: node scripts/lottie-boya.js girdi.json cikti.json ESKI=YENI [ESKI=YENI ...]");
  console.error("          node scripts/lottie-boya.js --liste girdi.json");
  process.exit(1);
}

const harita = new Map();
for (const e of eslesmeler) {
  const [a, b] = e.split("=");
  if (!a || !b) { console.error("gecersiz eslesme:", e); process.exit(1); }
  harita.set("#" + a.replace(/^#/, "").toUpperCase(), "#" + b.replace(/^#/, "").toUpperCase());
}

const j = JSON.parse(fs.readFileSync(girdi, "utf8"));
const sayac = new Map(), uyari = [];
gez(j.layers, (h) => {
  const y = harita.get(h);
  if (y) sayac.set(h, (sayac.get(h) || 0) + 1);
  return y || null;
}, uyari);

fs.writeFileSync(cikti, JSON.stringify(j));
console.log(`${girdi} -> ${cikti}`);
for (const [eski, yeni] of harita) {
  const n = sayac.get(eski) || 0;
  console.log(`  ${eski} -> ${yeni}  ${String(n).padStart(3)} yer${n === 0 ? "   <-- HIC BULUNAMADI" : ""}`);
}
uyari.forEach((u) => console.log("  UYARI:", u));
const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log(`  boyut: ${kb(fs.statSync(girdi).size)} -> ${kb(fs.statSync(cikti).size)}`);
