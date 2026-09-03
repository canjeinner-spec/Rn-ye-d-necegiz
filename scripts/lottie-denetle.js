#!/usr/bin/env node
/**
 * Bir Lottie dosyasi bu uygulamada duzgun calisir mi? Eklemeden ONCE bak.
 *
 * NEDEN VAR: "Zafer Gecesi" eklendi, pakete gomuldu, katalog satiri yazildi
 * ve ancak cihazda gorunce anlasildi ki lottie-android o dosyayi sadik
 * cizemiyor (kale aglari bembeyaz). 4.6 MB de bundle'i 6.6 -> 10 MB yapmisti.
 * Hepsi bu betikle bir saniyede gorulebilirdi.
 *
 * KULLANIM:
 *   node scripts/lottie-denetle.js dosya.json [dosya2.json ...]
 *   node scripts/lottie-denetle.js src/anim/gifts/*.json
 *
 * NEYE BAKIYOR (lottie-android'in gercek sinirlari):
 *   • merge path  -> Android'de varsayilan KAPALI. Anim.tsx'te actik ama
 *                    yavaslatabiliyor; cok sayida olmasi kotu isaret.
 *   • blend mode  -> multiply/screen gibi olanlar YOK SAYILIYOR, renk ucuyor.
 *   • efekt (ef)  -> cogu YOK SAYILIYOR.
 *   • katman      -> asil maliyet burada. ~80 uzeri riskli.
 *   • dis dosya   -> pakette olmayan gorseli cagiran dosya bos cizer.
 */
const fs = require("fs");
const path = require("path");

const dosyalar = process.argv.slice(2);
if (!dosyalar.length) {
  console.error("Kullanim: node scripts/lottie-denetle.js <dosya.json> ...");
  process.exit(1);
}

function denetle(yol) {
  const kb = fs.statSync(yol).size / 1024;
  const j = JSON.parse(fs.readFileSync(yol, "utf8"));
  const s = { mm: 0, ef: 0, bm: 0, tt: 0, gradyan: 0, dis: 0, metin: 0 };
  let katman = (j.layers || []).length;
  for (const a of j.assets || []) {
    if (a.layers) katman += a.layers.length;
    if (a.p && !String(a.p).startsWith("data:")) s.dis++;
  }
  const gez = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(gez);
    if (n.ty === "mm") s.mm++;
    if (n.ty === "gf" || n.ty === "gs") s.gradyan++;
    if (n.ty === 5) s.metin++;
    if (n.tt !== undefined) s.tt++;
    if (n.ef && n.ef.length) s.ef++;
    if (n.bm !== undefined && n.bm !== 0) s.bm++;
    Object.values(n).forEach(gez);
  };
  gez(j.layers); gez(j.assets);

  const sure = ((j.op - j.ip) / j.fr).toFixed(1);
  const sorun = [];
  const uyari = [];
  if (s.bm > 0) sorun.push(s.bm + " blend mode (renkler bozuk cizilir)");
  if (s.ef > 0) sorun.push(s.ef + " efekt (yok sayilir)");
  if (s.dis > 0) sorun.push(s.dis + " dis dosya (bos cizer)");
  if (katman > 80) sorun.push(katman + " katman (cok agir)");
  if (kb > 400) uyari.push(kb.toFixed(0) + " KB (buyuk; katman azsa sorun degil)");
  if (s.mm > 10) uyari.push(s.mm + " merge path (yavaslatabilir)");
  if (s.tt > 20) uyari.push(s.tt + " track matte");
  if (s.metin > 0) uyari.push(s.metin + " metin katmani (yazi tipi gomulu degilse bozulur)");

  const ad = path.basename(yol);
  const damga = sorun.length ? "RET  " : uyari.length ? "DIKKAT" : "TAMAM";
  console.log(damga + "  " + ad.padEnd(26) + kb.toFixed(0).padStart(5) + " KB  " +
    String(katman).padStart(4) + " katman  " + j.w + "x" + j.h + "  " + sure + "sn");
  for (const x of sorun) console.log("        - " + x);
  for (const x of uyari) console.log("        ~ " + x);
  return sorun.length === 0;
}

let temiz = 0;
for (const d of dosyalar) {
  try { if (denetle(d)) temiz++; }
  catch (e) { console.log("HATA   " + path.basename(d) + ": " + (e && e.message)); }
}
console.log("");
console.log(temiz + "/" + dosyalar.length + " dosya sorunsuz.");
