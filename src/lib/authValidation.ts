/**
 * Kayıt/giriş doğrulamaları — e-posta eleme ve şifre gücü.
 *
 * Neden var: kayıt ekranı önceden yalnızca "@ var mı" ve "6 karakter mi" diye
 * bakıyordu. `123456@gmail.com`, `admin@...`, `xkjfhqz@...` gibi adresler ve
 * `123456` şifresi sorunsuz geçiyordu.
 *
 * Kurallar bilinçli olarak TEK yerde toplandı; sıkı/gevşek ayarı buradan
 * yapılır, ekranlar sadece sonucu gösterir.
 */

/** Tek kullanımlık ("çöp") e-posta sağlayıcıları. */
const TEK_KULLANIMLIK = new Set([
  "mailinator.com", "yopmail.com", "guerrillamail.com", "sharklasers.com",
  "10minutemail.com", "tempmail.com", "temp-mail.org", "trashmail.com",
  "getnada.com", "dispostable.com", "fakeinbox.com", "maildrop.cc",
  "throwawaymail.com", "mohmal.com", "emailondeck.com", "spam4.me",
  "grr.la", "byom.de", "mailnesia.com", "tempr.email",
]);

/** Sistem/kurum adları — kimse bunlarla kayıt olmamalı. */
const YASAKLI_YEREL = new Set([
  "admin", "administrator", "root", "sistem", "system", "yonetici", "yönetici",
  "test", "tester", "deneme", "demo", "ornek", "örnek", "example", "user",
  "support", "destek", "info", "bilgi", "iletisim", "contact", "help", "yardim",
  "noreply", "no-reply", "postmaster", "hostmaster", "webmaster", "abuse",
  "security", "guvenlik", "moderator", "mod", "sales", "billing",
  "aron", "aronchat", "aron-chat",
]);

/** Marka/rol taklidi: "admin_", "test-", "_admin", "-test" gibi ekler. */
const YASAKLI_PARCA = ["admin", "test", "deneme", "noreply", "no-reply", "root", "aronchat"];

const SESLI = /[aeıioöuüAEIİOÖUÜ]/;

export type DogrulamaSonuc = { ok: boolean; hata?: string };

/**
 * E-posta elemesi.
 *
 * Kabul edilmeyenler: biçimsiz adresler, tek kullanımlık sağlayıcılar,
 * rol/sistem adları (admin@, test@), rakamla başlayanlar, rakam ağırlıklı ya
 * da sesli harfsiz "rastgele" görünen yereller.
 */
export function epostaKontrol(ham: string): DogrulamaSonuc {
  const eposta = ham.trim().toLowerCase();
  if (!eposta) return { ok: false, hata: "E-posta gerekli." };
  if (eposta.length > 254) return { ok: false, hata: "E-posta çok uzun." };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) {
    return { ok: false, hata: "Geçerli bir e-posta adresi gir." };
  }

  const [yerelHam, alan] = eposta.split("@");
  // "ali+etiket@..." → etiket doğrulamada sayılmaz.
  const yerel = yerelHam.split("+")[0];

  if (!/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/.test(yerelHam)) {
    return { ok: false, hata: "E-posta adında geçersiz karakter var." };
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(alan)) {
    return { ok: false, hata: "Alan adı geçerli değil." };
  }
  if (TEK_KULLANIMLIK.has(alan)) {
    return { ok: false, hata: "Geçici e-posta adresleri kabul edilmiyor." };
  }
  if (yerel.length < 3) {
    return { ok: false, hata: "E-posta adı en az 3 karakter olmalı." };
  }

  if (YASAKLI_YEREL.has(yerel)) {
    return { ok: false, hata: "Bu e-posta adı sistem için ayrılmış." };
  }
  for (const p of YASAKLI_PARCA) {
    if (yerel.startsWith(p) || yerel.endsWith(p)) {
      return { ok: false, hata: `"${p}" ile başlayan/biten adresler kabul edilmiyor.` };
    }
  }

  if (/^\d/.test(yerel)) {
    return { ok: false, hata: "E-posta adı rakamla başlayamaz." };
  }
  if (/^\d+$/.test(yerel)) {
    return { ok: false, hata: "E-posta adı yalnızca rakamlardan oluşamaz." };
  }
  if (/\d{5,}/.test(yerel)) {
    return { ok: false, hata: "E-posta adında çok fazla ardışık rakam var." };
  }
  if (/\d{4,}$/.test(yerel)) {
    return { ok: false, hata: "E-posta adı uzun bir rakam dizisiyle bitemez." };
  }

  const rakam = (yerel.match(/\d/g) || []).length;
  if (yerel.length >= 6 && rakam / yerel.length > 0.4) {
    return { ok: false, hata: "E-posta adı rakam ağırlıklı görünüyor." };
  }
  const harfler = yerel.replace(/[^a-zçğıöşü]/g, "");
  if (harfler.length >= 7 && !SESLI.test(harfler)) {
    return { ok: false, hata: "E-posta adı rastgele görünüyor." };
  }
  if (/(.)\1{3,}/.test(yerel)) {
    return { ok: false, hata: "E-posta adında aynı karakter çok tekrar ediyor." };
  }

  return { ok: true };
}

/** En sık kullanılan/sızmış şifreler — uzunluğu tutsa bile reddedilir. */
const YAYGIN = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "password",
  "password1", "passw0rd", "qwerty", "qwerty123", "asdasd", "asd123",
  "111111", "123123", "abc123", "iloveyou", "admin123", "welcome",
  "sifre123", "şifre123", "parola", "parola123", "deneme123", "aron123",
  "galatasaray", "fenerbahce", "besiktas", "trabzonspor",
]);

/** Klavye/alfabe dizileri — "abcdef", "qwerty", "987654" gibi. */
function dizisel(s: string): boolean {
  const d = s.toLowerCase();
  const siralar = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  for (const sira of siralar) {
    const ters = [...sira].reverse().join("");
    for (let i = 0; i + 4 <= d.length; i++) {
      const p = d.slice(i, i + 4);
      if (sira.includes(p) || ters.includes(p)) return true;
    }
  }
  return false;
}

export type SifreGucu = {
  /** 0-4 */
  skor: number;
  etiket: string;
  renk: string;
  /** Kullanıcıya gösterilecek eksikler. */
  ipuclari: string[];
  /** Kayıt için yeterli mi (skor >= 2 ve en az 8 karakter). */
  yeterli: boolean;
};

/**
 * Şifre gücü — uzunluk + karakter çeşitliliği, dizisel/tekrar/yaygın cezaları.
 * `eposta` verilirse şifrenin e-posta adını içermesi de cezalandırılır.
 */
export function sifreGucu(sifre: string, eposta?: string): SifreGucu {
  const s = sifre;
  const ipuclari: string[] = [];

  if (!s) {
    return { skor: 0, etiket: "—", renk: "#5C5A66", ipuclari: ["En az 8 karakter"], yeterli: false };
  }

  const kucuk = /[a-zçğıöşü]/.test(s);
  const buyuk = /[A-ZÇĞİÖŞÜ]/.test(s);
  const rakam = /\d/.test(s);
  const simge = /[^A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(s);
  const sinif = [kucuk, buyuk, rakam, simge].filter(Boolean).length;

  let puan = 0;
  if (s.length >= 8) puan += 1;
  if (s.length >= 12) puan += 1;
  if (s.length >= 16) puan += 1;
  if (sinif >= 3) puan += 1;
  if (sinif === 4) puan += 1;

  if (s.length < 8) ipuclari.push("En az 8 karakter");
  if (!buyuk) ipuclari.push("Bir büyük harf");
  if (!rakam) ipuclari.push("Bir rakam");
  if (!simge) ipuclari.push("Bir simge (!?*.)");

  const yerel = eposta?.split("@")[0]?.toLowerCase();
  if (yerel && yerel.length >= 3 && s.toLowerCase().includes(yerel)) {
    puan -= 2;
    ipuclari.push("E-posta adını içermesin");
  }
  if (/(.)\1{2,}/.test(s)) {
    puan -= 1;
    ipuclari.push("Aynı karakteri tekrarlama");
  }
  if (dizisel(s)) {
    puan -= 2;
    ipuclari.push("Ardışık dizi kullanma (abcd, 1234)");
  }
  if (YAYGIN.has(s.toLowerCase())) {
    puan = 0;
    ipuclari.length = 0;
    ipuclari.push("Bu şifre çok yaygın, tahmin edilir");
  }

  const skor = Math.max(0, Math.min(4, puan));
  const etiketler = ["Çok zayıf", "Zayıf", "Orta", "Güçlü", "Çok güçlü"];
  const renkler = ["#F87171", "#F87171", "#E8B341", "#34D399", "#5EEAD4"];

  return {
    skor,
    etiket: etiketler[skor],
    renk: renkler[skor],
    ipuclari: ipuclari.slice(0, 3),
    yeterli: skor >= 2 && s.length >= 8,
  };
}

/** Kullanıcı adı için ayrılmış/uygunsuz adlar. */
const YASAKLI_AD = new Set([
  "admin", "administrator", "root", "sistem", "system", "yonetici", "yönetici",
  "moderator", "moderatör", "mod", "destek", "support", "yardim", "help",
  "aron", "aronchat", "aronofficial", "resmi", "official", "test", "deneme",
  "kullanici", "user", "null", "undefined", "anonim", "misafir", "guest",
]);

/**
 * Kullanıcı adı kuralları.
 *
 * Eskiden tek şart "2 karakter"di: `..`, `@@@`, `admin` gibi adlar geçiyordu.
 * Kural: 3-20 karakter, harfle başlar, harf/rakam/alt çizgi/nokta, üst üste
 * ayraç yok, ayraçla bitmez.
 */
export function kullaniciAdiKontrol(ham: string): DogrulamaSonuc {
  const ad = ham.trim();
  if (!ad) return { ok: false, hata: "Kullanıcı adı gerekli." };
  if (ad.length < 3) return { ok: false, hata: "En az 3 karakter olmalı." };
  if (ad.length > 20) return { ok: false, hata: "En fazla 20 karakter olabilir." };
  if (/\s/.test(ad)) return { ok: false, hata: "Boşluk kullanılamaz, yerine _ koyabilirsin." };
  if (!/^[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(ad)) return { ok: false, hata: "Harfle başlamalı." };
  if (!/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ._]+$/.test(ad)) {
    return { ok: false, hata: "Yalnızca harf, rakam, nokta ve alt çizgi." };
  }
  if (/[._]{2,}/.test(ad)) return { ok: false, hata: "Nokta/alt çizgi üst üste gelemez." };
  if (/[._]$/.test(ad)) return { ok: false, hata: "Nokta veya alt çizgiyle bitemez." };
  if (YASAKLI_AD.has(ad.toLowerCase())) return { ok: false, hata: "Bu ad sistem için ayrılmış." };
  return { ok: true };
}
