#!/usr/bin/env node
/**
 * Lottie JSON -> statik PNG (hediye kutusu karolari icin).
 *
 * NEDEN: her Lottie ayri bir native gorunum ve kendi kompozisyon agaci.
 * Hediye kutusunda alti tanesi ayni anda duruyordu; duruk kare (`progress`)
 * cizim dongusunu durdursa bile agaci YINE kuruyordu, izgara akici olmuyordu.
 * Karar: karolarda statik gorsel, animasyon yalniz gonderim efektinde —
 * rakiplerin (Yalla/WePlay) yaptigi da bu. `scripts/lottie-boya.js` ailesinden.
 *
 * NASIL: lottie-web'in SVG cizicisi jsdom icinde calisiyor, istenen karede
 * durduruluyor, olusan SVG resvg ile PNG'ye cevriliyor. Tamamen cevrimdisi.
 *
 * NEDEN TARAYICI DEGIL: once headless Edge denendi; bu makinede --screenshot
 * sessizce hicbir sey uretmiyor (cikis kodu 0, dosya yok). jsdom + resvg
 * hem calisiyor hem de tarayici kurulumuna bagli degil.
 *
 * KULLANIM:
 *   node scripts/lottie-png.js                 # src/anim/gifts/*.json -> png/
 *   node scripts/lottie-png.js --oran 0.35     # farkli kare (0-1, varsayilan 0.5)
 *   node scripts/lottie-png.js --boyut 192     # kenar (piksel, varsayilan 256)
 *   node scripts/lottie-png.js gul ayicik      # yalniz bu kodlar
 *
 * KARE SECIMI: varsayilan 0.5. Ilk kare genelde bostur (nesneler sahneye
 * sonradan girer), son kare sahne dagilmisken yakalar. Sonuc kotuyse --oran.
 *
 * YENI HEDIYE EKLERKEN: json'u src/anim/gifts/ altina koy, bu betigi calistir,
 * ciktiyi `src/gifts/giftPng.ts` haritasina ekle.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { Resvg } = require("@resvg/resvg-js");

const KAYNAK_DIZIN = path.join(__dirname, "..", "src", "anim", "gifts");
const HEDEF_DIZIN = path.join(KAYNAK_DIZIN, "png");

function arg(ad, varsayilan) {
  const i = process.argv.indexOf("--" + ad);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : varsayilan;
}
const varsayilanOran = Math.min(1, Math.max(0, parseFloat(arg("oran", "0.5"))));

/**
 * Hediyeye ozel kare. 0.5 cogu dosyada iyi sonuc veriyor ama hepsinde degil:
 * tavsan 0.5'te iki tavsani kirpilmis ve dagilmis yakaliyordu, 0.85'te ikisi
 * yan yana ve kalp ustte duruyor. Burasi kayitli olmasa "hangi oranla
 * uretmistim" bilgisi kaybolur ve betik tekrar calistirildiginda gorsel
 * sessizce degisirdi.
 */
const KARE = { tavsan: 0.85 };
const boyut = parseInt(arg("boyut", "256"), 10);
const oranVerildi = process.argv.includes("--oran");
const atla = new Set(["--oran", "--boyut"]);
const secilen = process.argv.slice(2).filter((a, i, d) => !a.startsWith("--") && !atla.has(d[i - 1]));

// lottie-web tarayici globallerini modul yuklenirken ariyor: once kur.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

// jsdom'da canvas YOK. lottie-web modul yuklenirken 1x1 bir canvas acip
// `ctx.fillStyle` ve `ctx.fillRect` cagiriyor (ImagePreloader.proxyImage);
// getContext null donunce daha ilk satirda patliyor. Gomulu gorseli olmayan
// dosyalarla calistigimiz icin (hepsinde gomulu gorsel = 0) bu iki cagriyi
// karsilayan kucuk bir taklit yeterli — canvas npm paketini kurmaya gerek yok.
dom.window.HTMLCanvasElement.prototype.getContext = () => ({
  fillStyle: "", fillRect() {}, clearRect() {}, drawImage() {},
  getImageData: () => ({ data: [] }),
});

// SVG-ONLY YAPI. Tam `lottie-web` yuklenirken canvas yoklamasi yapiyor
// (ctx.fillStyle) ve jsdom'da getContext yok -> modul daha yuklenirken patliyor.
// lottie_svg canvas'a hic dokunmuyor ve zaten SVG cizicisini kullaniyoruz.
const lottie = require("lottie-web/build/player/lottie_svg");

fs.mkdirSync(HEDEF_DIZIN, { recursive: true });
const dosyalar = fs.readdirSync(KAYNAK_DIZIN)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !secilen.length || secilen.includes(path.basename(f, ".json")));
if (!dosyalar.length) { console.error("Islenecek dosya yok."); process.exit(1); }

let basarili = 0;
for (const dosya of dosyalar) {
  const kod = path.basename(dosya, ".json");
  const girdi = path.join(KAYNAK_DIZIN, dosya);
  const cikti = path.join(HEDEF_DIZIN, kod + ".png");
  try {
    const veri = JSON.parse(fs.readFileSync(girdi, "utf8"));
    const kutu = document.createElement("div");
    document.body.appendChild(kutu);
    const anim = lottie.loadAnimation({
      container: kutu, renderer: "svg", loop: false, autoplay: false, animationData: veri,
    });
    // goToAndStop KARE cinsinden; ikinci arguman "bu bir kare numarasi" demek.
    const oran = !oranVerildi && KARE[kod] !== undefined ? KARE[kod] : varsayilanOran;
    anim.goToAndStop(Math.max(0, Math.floor(anim.totalFrames * oran)), true);

    const svg = kutu.querySelector("svg");
    if (!svg) throw new Error("svg uretilmedi");
    // lottie-web genislik/yukseklik yerine style veriyor; resvg icin acik olcu
    // ve viewBox sart, yoksa 0x0 cikiyor.
    svg.setAttribute("width", String(veri.w));
    svg.setAttribute("height", String(veri.h));
    svg.setAttribute("viewBox", "0 0 " + veri.w + " " + veri.h);
    svg.removeAttribute("style");

    const png = new Resvg(svg.outerHTML, {
      fitTo: { mode: "width", value: boyut },
      background: "rgba(0,0,0,0)", // saydam: karo koyu temanin ustunde
    }).render().asPng();
    fs.writeFileSync(cikti, png);

    anim.destroy();
    kutu.remove();

    const kb = (n) => (n / 1024).toFixed(0).padStart(5);
    console.log("  " + kod.padEnd(8) + kb(fs.statSync(girdi).size) + " KB json ->" + kb(png.length) + " KB png");
    basarili++;
  } catch (e) {
    console.error("  " + kod.padEnd(8) + " BASARISIZ: " + (e && e.message));
  }
}
console.log("");
console.log(basarili + "/" + dosyalar.length + " uretildi -> " + path.relative(process.cwd(), HEDEF_DIZIN));
