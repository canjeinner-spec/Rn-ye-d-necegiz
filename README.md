# Aron Chat

Türkçe sesli sohbet odası uygulaması — React Native / Expo SDK 54 /
expo-router / Zustand / Supabase.

## Önce bunları oku

| Dosya | Ne için |
|---|---|
| **`PROJE_DURUMU.md`** | Projenin tamamı: mimari, ekranlar, ortam kısıtları, ne bitti ne bitmedi, açık hatalar. **Yeni bir oturuma başlarken önce bu.** |
| **`db/SEMA_DOKUMU.md`** | Canlı veritabanı dökümü: 104 tablo, 838 sütun, 131 fonksiyon, 23 enum. **Migration yazmadan önce zorunlu.** |
| `db/migrations/` | Sıralı SQL dosyaları. Hangisinin uygulandığı `PROJE_DURUMU.md` §10'da. |

Temel şemanın (kullanicilar, odalar, hediyeler, cuzdanlar…) repoda kaynak
dosyası **yok**; doğrudan Supabase'te kurulu. Neyin zaten var olduğunu
bilmeden migration yazmak çakışma üretiyor — nitekim üretti.

## Mimari kural — taşıyıcı seçimi

Oda içi her şey bir dönem Realtime **presence** ile taşınıyordu ve üç oturum
boyunca kararsız çalıştı. Kural netleşti:

| Ne | Nasıl taşınır |
|---|---|
| **Durum** — kim nerede oturuyor, mikrofonu açık mı, koltuk kilitli mi, odada kim var | **Tablo + `postgres_changes`** |
| **Olay** — sohbet mesajı, giriş efekti, emoji tepkisi, mikrofon daveti | **broadcast** |
| Kozmetik — kuşanılan çerçeve/balon | presence (geç gelirse zararsız) |

Sebep: broadcast hızlı ama **kaçan olayın telafisi yok**; presence hem kaçırıyor
hem aynı anahtarda birden çok kayıt tutabiliyor. Tabloda durum kalıcı — kaçan
olay bir sonraki okumada zaten doğru geliyor. Yeni bir oda özelliği eklerken
önce "bu olay mı, durum mu" sorusunu cevapla.

Not: `src/data/remote/odaVarlik.ts` (genel presence kanalı) bu yüzden silindi.

## Çalıştırma

⚠️ **Bu makine bir bulut sunucusu (AWS).** Telefon yerel ağa ulaşamaz, QR kod
çalışmaz. Tünel zorunlu.

```powershell
# 1) Tünel (ayrı kabuk)
& ".\.tools\cloudflared.exe" tunnel --url http://localhost:8081 --no-autoupdate
#    çıktıdan https://<ad>.trycloudflare.com adresini al

# 2) Metro (ayrı kabuk)
$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:Path"
$env:EXPO_PACKAGER_PROXY_URL = "https://<ad>.trycloudflare.com"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "<ad>.trycloudflare.com"
node .\node_modules\expo\bin\cli start --clear
```

**Telefonda:** Expo Go → *Enter URL manually* → `exp://<ad>.trycloudflare.com`
(QR'a bakma, o hâlâ ulaşılamayan yerel adresi gösterir.)

İlk bundle ~50 sn. Expo Go ~15 sn'de vazgeçtiği için ikisini önden ısıtmak
gerekiyor:

```bash
curl -s -o /dev/null "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src%2Fapp&transform.reactCompiler=true&unstable_transformProfile=hermes-stable"
# aynısını platform=android ile tekrarla
```

## Tip kontrolü

`npx` PATH'te değil:

```bash
node ./node_modules/typescript/bin/tsc --noEmit
```

## Yapı

```
src/app/          expo-router ekranları  (room.tsx oda sahnesi)
src/components/   paylaşılan bileşenler
src/sheets/       alttan açılan paneller
src/data/remote/  Supabase erişim katmanı (*Repo.ts)
src/store/        Zustand (appStore.ts)
db/migrations/    sıralı SQL
```

## Dil

Kod yorumları, commit mesajları ve arayüz **Türkçe**. Commit mesajlarında
diakritik kullanılmıyor (ASCII).

---

## Durum — 4 Eylül 2026

Son oturumda 27 commit: hediye sistemi (7 hediye, PNG karo + Lottie efekt),
üretilen hediye sesleri, efekt kuyrugu, sohbet/liste gorunumu ve KOLTUK
KARARLILIGI (alti ayri kok sebep).

Ayrinti icin `PROJE_DURUMU.md` §10 — orada oturum bolumu ve acik kalanlar var.
Plan icin `YOL_HARITASI.md` (Faz 1 maddeleri 1.17-1.22 eklendi).

**Bekleyen:** Faz 0 iki cihaz duman testi hala yapilmadi; `ARKAPLAN_MS = 20000`
(arkaplanda 20 sn sonra odadan dusme) kullanici onayi bekliyor.

Uc yeni betik: `scripts/lottie-denetle.js`, `scripts/lottie-png.js`,
`scripts/hediye-sesi-uret.js` (+ `ses-incele.js`, `kuyruk-testi.js`).
