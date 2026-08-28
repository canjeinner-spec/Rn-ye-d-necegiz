# Aron Chat — Oturum Durumu

**Son güncelleme:** 2026-08-28
**Proje yolu:** `C:\Users\Administrator\Desktop\Rn-ye-d-necegiz`
**Dal:** `claude/metro-recovery-1xc2kq`
**Son commit:** `4ec819c` — Alt sekme çubuğunu canlandır, sahte rozetleri kaldır

Bu belge, oturum çökmelerine karşı nerede kaldığımızı korumak için tutuluyor.
Yeni bir oturuma başlarken önce burayı oku.

> **Not:** Proje `C:\dev\Rn-ye-d-necegiz`'den masaüstüne taşındı (2026-08-28).
> Eski yola atıf yapan bir şey görürsen yolu güncelle. `C:\dev` boş kaldı.

---

## 🚀 PROJEYİ ÇALIŞTIRMA

```powershell
cd "$env:USERPROFILE\Desktop\Rn-ye-d-necegiz"
npx expo start --clear
```

Telefon aynı ağdaysa QR yeterli. Makinenin LAN IP'si: `172.31.21.78`

### PATH sorunu

`npx`, `git`, `node` PATH'te **değil**. Her yeni kabukta:

```powershell
$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:Path"
```

### Tip kontrolü

```powershell
node node_modules\typescript\bin\tsc --noEmit
```
(`npx tsc` çalışmaz — PATH.)

### Port 8081 doluysa

Bu ortamda Metro'nun ölü süreçleri kalabiliyor. Önce sahibini bul, sonra
ağacı kapat:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*Rn-ye-d-necegiz*" } |
  ForEach-Object { "PID {0}  {1}" -f $_.ProcessId, $_.Name }
taskkill /PID <metro-pid> /T /F
```

Metro `expo start` → `cmd` → `node .../expo/bin/cli` → 3 × `jest-worker`
zinciri açar; `/T` ile hepsi birden gider. **Klasörü taşımadan/silmeden önce
Metro'yu mutlaka kapat** — açıkken dosya kilidi verir.

### Tünel (telefon farklı ağdaysa)

Bu ortamda tünel sorunluydu, denenenler ve sonuçları:

| Yöntem | Sonuç |
|---|---|
| `--tunnel` (ngrok) | ❌ `CommandError: TypeError: Cannot read properties of undefined (reading 'body')` — iki kez. Kullanıcı "ngrok deneme" dedi. `@expo/ngrok` kurulu ama çalışmıyor. |
| Bolt/WebContainer tüneli | ❌ 502. Sebep: `EXPO_FORCE_WEBCONTAINER_ENV=1` Expo'ya "tüneli platform sağlıyor" dedirtiyor; Metro'nun **hiç giden bağlantısı olmuyordu** (`Get-NetTCPConnection -OwningProcess` ile bulundu). |
| **cloudflared quick tunnel** | ✅ Çalıştı. Ama **kalıcı kurulu değil** — o gün geçici indirilmişti, şu an makinede yok. |

cloudflared tekrar gerekirse:

```powershell
# 1) cloudflared'i indir (kurulum gerekmez, tek exe)
# 2) Metro'yu başlat, sonra ayrı bir kabukta:
cloudflared tunnel --url http://localhost:8081
# 3) verdiği https adresini Expo'ya bildir ve Metro'yu YENİDEN başlat:
$env:EXPO_PACKAGER_PROXY_URL = "https://<verilen-adres>.trycloudflare.com"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "<verilen-adres>.trycloudflare.com"
npx expo start --clear
```

Şu an bu değişkenlerin hiçbiri sistemde tanımlı değil (temiz durum).

### Bilinen çalıştırma sorunları

- **Splash Expo Go'da görünmüyor** (dev build gerekir).
- **`expo-video` cihazda denenmedi** — Expo Go'da olmayabilir; giriş
  ekranındaki arka plan videosu için dev build gerekebilir.

---

## ⚠️ ÖNCE BUNLARI YAP

### 1. Çalıştırılmayı bekleyen migration'lar

Bunlar yazıldı, commit'lendi ama **Supabase'de çalıştırılmadı**:

| Dosya | Ne yapıyor | Çalıştırılmazsa |
|---|---|---|
| `db/migrations/051_rozet_kusanma_kurallari.sql` | Seviye rozetlerinin kuşanılmasını sunucuda reddeder | Kural yalnızca istemcide; API'den kuşanılabilir |
| `db/migrations/053_admin_oda_kapak.sql` | `admin_oda_kapak_ayarla` — yönetici oda kapağını değiştirir/kaldırır | Yönetim ekranındaki kapak düğmeleri hata döndürür |
| `db/migrations/054_oda_islem_isareti.sql` | `odalar.islem_gordu / islem_sebep / islem_tarihi` + `admin_oda_islem_isaretle` + `odalar_update` politikası | İşlem işareti hiç çalışmaz (uyarı, kilit, liste filtresi ölü) |

`052_oda_vitrin.sql` **çalıştırıldı** (kullanıcı onayladı).

> **Kritik kural:** Client kodunu uygulanmamış bir migration'a bağlama.
> Bu oturumdan önce `kusanilan_rozet` kolonu DB'de yokken SELECT'e eklenmiş
> ve **tüm profil okumaları** `42703` ile çökmüştü. Bu yüzden `roomsRepo`'daki
> oda sorgusu artık kendini koruyor: yeni kolonlar yoksa temel kolonlara
> düşüp çalışmaya devam ediyor (`odalariGetir`).

### 2. Güvenlik

- Kullanıcı **secret key**'ini (`sb_secret_...`) bir kez sohbete yapıştırdı.
  Döndürülmesi (rotate) söylendi. **Secret key hiçbir dosyaya yazılmadı.**
- Uygulama yalnızca `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  kullanıyor. `.env` gitignore'da (`.gitignore:34`).
- Repo **public**, dolayısıyla tüm güvenlik RLS'te.

### 3. Push edilmedi

Commit'ler yerelde. GitHub'a push için kimlik doğrulaması gerekiyor
(`gh auth login` kurulu ama çalıştırılmadı).

---

## Proje

Türkçe sesli sohbet odası + sosyal mobil uygulama.
React Native / Expo SDK 54 / expo-router 6 / Zustand / Supabase.
New Architecture açık. Referans uygulamalar: **WePlay** (oda sahnesi) ve
**Yalla** (üst bar).

---

## Bu oturumda yapılanlar

### A. Oda ekranı — WePlay/Yalla referanslı yeniden düzen

| Commit | İş |
|---|---|
| `967ab70` | **Mikrofon sırası ayrı sayfaya alındı** (`MicQueueSheet`). Sağ alttaki düğme oda profilinin 3. sekmesini açıyordu; sırayı görmek için oda kimlik kartı + üç sekme + Katıl/Takip Et geliyordu. İkon mikrofon → **el kaldırma** (`paths.ts: hand`), üstünde bekleyen sayısı rozeti. |
| `f1afcfc`, `6d412f2` | **Koltuk ölçüleri WePlay'den ölçüldü.** Referans SS 1290px (430pt @3x): koltuk 55pt, sahip 91pt, ızgara tam ekran genişliğinde. Sabit piksel yerine oran: çap = sütunun %51'i. Izgaranın 14pt yatay dolgusu kaldırıldı (asıl sıkışıklık sebebi buydu: çap/sütun %60 → %51). Boş koltuklar dolgusuz + ince altın halka. |
| `adf75ab` | Sahip/koltuk oranı 1.65 → **1.5** (bizde sahibin altında isim + yetki etiketi var). **Oda sahibi başka koltuğa oturamaz** — üç yol da kapatıldı (koltuk sayfası, `sitHere`, `raiseHand` + sırada "El Kaldır" butonu gizli). |
| `f1afcfc`…`b133c60` | **Oda çipi Yalla'ya göre:** ekranın sol kenarına yapışık (solu köşeli, sağı ovalleşen), yumuşak beyaz saydamlık (`rgba(255,255,255,.09)`), yükseklik 40 → 46pt. Genişlik içeriğe göre (alt sınır denendi, "sırıtıyor" denince kaldırıldı). |
| `d79e4e9` | "Saatlik sıra" çipi de sol duvara yapıştırıldı, aynı dil. |
| `7b68bb0` | **Üst bardaki geri oku kaldırıldı** — güç düğmesinin modalında zaten "Küçült" var, aynı işi yapıyordu. |
| `bdc15dc` | Mikrofon-kapalı rozeti avatarın **tam ortasının altındaydı** (`left: "50%"`), yüzün üstüne biniyordu → sağ alt köşe. İkisi birden varsa çevrimiçi noktası sağ üste kaçıyor. |
| `d0473bf` | **Tema odaya hiç uygulanmıyordu.** Zemin sabit gri gradyandı, `Scene` yalnızca 36px'lik çipin içinde kullanılıyordu. Zemin artık `<Scene kind={room.scene} />` + okunabilirlik perdesi. |
| `b70209d` | Oda çipine **kazanılmış oda rozetleri** (ID'nin yanında, 6px aralık, 14px). |

### B. Oda profili paneli (`RoomPanel`)

`b3643b6` — **Tek akan sayfaya çevrildi.** Eskiden: sayfa → kimlik kartı kutusu
→ sekmeler → sekmenin içinde level kutusu + bilgi kutusu (kutu içinde kutu).

Daha kötüsü, **Profil sekmesindeki verinin neredeyse tamamı sabitti:**
```js
const ROOM_LV = 29; const ROOM_XP = 13490; const ROOM_NEXT = 15000;
```
Her odada LV.29, 13.490/15.000, "Dil: Türkçe", "Ülke: Türkiye". `Room` tipinde
bu alanların hiçbiri yok.

Yeni: kapak (bulanık dolgu + yuvarlak oda avatarı) → gerçek sayı şeridi
(odadaki / üye / etiket) → duyuru → **oda sahibi satırı** (yeni) + oda
istatistikleri → üye listesi. Sekme yok.

`1fcb58d` — **Oda fotoğrafı her yerde avatar gibi.** Kırpma 16:9 idi ama her
yerde kare/yuvarlak gösteriliyordu (liste 62×62, çip 36×36) → kırpma `[1,1]`,
önizlemeler yuvarlak. RoomPanel'de bulanık dolgu + tam görünen avatar.
Küçültülmüş oda banner'ında hiç foto yoktu. Sahip avatarı boştu (Room tipinde
sahip fotoğrafı yok → üye listesindeki "sahip" kaydından alındı).

`7d610d5` — **"Sahip" → "Oda Sahibi"** (ortak `RolePill`). **Odadaki
kullanıcılar listesinde canlı odada hiç rol gösterilmiyordu**: `getRoomMembers`
çağrılıyor ama yalnız kendi rolüm alınıp liste atılıyordu → `uid → rol` haritası.

### C. Profil kartı (odada kişiye tıklayınca)

`6dba187` — Kart **herkese aynı sabit rozetleri** gösteriyordu
(`CARD_BADGES` = developer + VIP + "Aron Stars" ajansı). Gerçek profil çekiliyor:
seviye, kuşanılan rozet, özel kimlik, biyografi, konum, takipçi sayıları.
Role göre renklenen künye, istatistik şeridi, Mesaj/Takip/Profil üçlüsü.

`16d995f` — Rozet açıklama kartıyla aynı cam doku (blur 30→22, dolgu .60→.30),
küçültüldü. **Seviye eşitlendi**: avatarın üstündeki "LV.29" çipi kaldırıldı,
profildeki gibi **rütbe rozeti** olarak rozet sırasında (28px).

### D. Sahte veri temizliği

| Yer | Neydi | Ne oldu |
|---|---|---|
| `user-profile` | "Katıldığı Odalar: **959 oda**" sabit | `oda_uyeleri`'nden gerçek sayı (`getUserRoomCount`) |
| `user-profile` | Seviye bilinmiyorsa **LV.28**, ID bilinmiyorsa **1149663822** | Gösterilmiyor / "—" |
| `user-profile` | Cinsiyeti boş olan herkese "Erkek", ülkesi boş olana "🇹🇷 Türkiye" | Yalnızca veri varsa |
| `user-profile` | "Profil" sekmesi koşulsuz "henüz bilgi eklememiş" | DB'de ne varsa listeleniyor |
| `profile` (kendi) | Cüzdan satırı **"12.4K" altın / "860" elmas** sabit | `getMyBalance` + `wallet:bal` önbelleği |
| `wallet` | Kayıt yokken **sahte örnek işlemler**, uyarı yok | Gerçek boş durum kartı |
| `wallet` | Yayıncı **$142.50** ve **$92.40** sabit | "—" + "Ödeme sistemi yakında" |
| `BottomNav` | DM rozetinde sabit **"3"**, akışta koşulsuz kırmızı nokta | Gerçek okunmamış toplamı / nokta kaldırıldı |
| `special-id` | "Bu Ay Yüklenen Altın: 0 / Bu Ayki Seviye: Yok / Sıralama: 0" | Kaldırıldı (veri kaynağı yok) |
| `index` (oda listesi) | `mapRoom`'da `live: true` **sabit** — boş oda dahil hepsi "Canlı" | `aktif_katilimci_sayisi > 0` |
| `index` | Kartta "Arkadaşlar" etiketi ama gösterilenler odadakiler; gerçek odada `crowd: []` olduğu için boş | Oda sahibinin adı |

**Hâlâ sahte (kasıtlı bırakıldı):**
- `data/tasks.ts` — günlük ödül günleri ve görev ilerlemeleri. Görev sistemi DB'de yok.
- "Normal Hediyeler: 4.926" — `FEATURES.profileGift: false` olduğu için çizilmiyor.
- `RoomPanel`'de mock oda üye listesi (gerçek odada DB'den geliyor).
- Oda rozetleri (`Room.badges`) yalnızca `ROOMS` mock dizisinde; DB'de oda rozet tablosu yok.

### E. Oda listesi (ana sayfa)

`393d66d` — **Üst sekmeler hiçbir şey yapmıyordu**: `tab` state'i yalnız çubuğu
boyuyordu, dördü de aynı listeyi gösteriyordu.

`bc434a2`, `99fd630`, `cbddc21`, `5ce2d1e` — Sekmeler **Keşfet · Popüler · Yeni · Resmî**:
- **Popüler**: kalabalıktan seyreğe
- **Yeni**: yalnızca **normal** odalar (resmî/Top hariç), son **7 günde** kurulmuş, **etkileşime** göre
- **Resmî**: yalnızca resmî odalar

**Sıralama kuralı** (her sekmede): resmî → Daily Top (Top1, Top2…) → normal.

**Görünürlük kuralı** (istisnasız): **gizli/kilitli, yasaklandığım, işlem görmüş
ve boş** odalar listelenmez. (Silinmişler zaten RLS'te.) Sahip istisnası
kaldırıldı — sahip odasına profildeki "Odam"dan giriyor.

Sekme çubuğu banner'ın **üstündeydi** → banner ile listenin arasına alındı.
`RoomCrest` 124px'ti ve `top:-22` ile `overflow:hidden` kartın dışına taşıp
kırpılıyordu → 96px, kartın içinde. Resmî/Daily renkleri mavi-mor → altın.

### F. Banner

`7b68bb0` → `5218cbd` — Üç kez oran değişti, sonunda **doğru çözüm bulundu**:
sabit çerçeveye foto sığdırmak yanlıştı. **Çerçeve artık fotoğrafın kendi
oranını alıyor** (`onLoad` ile ölçülüyor, 2.2–4.2 arasına sınırlı). Ne kırpılıyor
ne boşluk kalıyor. Yükleme kırpması `[7,2]`, önerilen 1680×480.

Kök sebep geçmişi: kırpma 16:9 ↔ çerçeve ~3:1 uyumsuzluğu → fotoğrafın alt-üstü
kayboluyordu.

### G. Tema birliği (siyah-altın)

Uygulamanın teması `colors.ts`'te "siyah-altın premium" ama birçok ekran
kendi rengindeydi:

| Ekran | Eski zemin | Commit |
|---|---|---|
| Cüzdan | `#1A1430` mor + mor sekmeler + camgöbeği kart | `1015c21` |
| Profil | `#1E1530 → #241B0A` mor-kahve kapak | `0791cb2`, `6d29dfa` |
| Görevler | `#1E1330` mor | `37ab777` |
| Özel ID | `#2A2012` kahve | `d59ba84` |
| 9 admin ekranı | `#241B0A` kahve | `4e833f8` |

Emoji temizliği: 🏦 🧾 🎖️ ⚠️ 🔒 ✓ 💎 ❧ ☙ ◆◇ ↻ → ikon setinden
(`bank`, `wallet`, `clipboard`, `shield`, `idcard`, `lock`, `check`, `crown`).

### H. Sekme geçişi

`37ab777` — Cüzdan ve Görevler'de "segment" tarzı geçiş vardı: seçili sekme dolu
gradyan buton, diğeri boş kutu — sekme mi aksiyon mu belli değildi.

Mevcut `components/Tabs.tsx` geliştirildi: **çizgi artık kayıyor** (220ms,
`onLayout` ile ölçüm) ve yeni **`fill` modu** (eşit genişlik + ortalanmış bar).
Kullananlar: ana sayfa, sıralama, akış, DM, preview, cüzdan, görevler, özel ID,
yönetim, kullanıcı yönetimi.

### I. Özel ID sayfası + taht kartı

`d59ba84` — **Kral tacı iç içe giriyordu.** Süslemeler emojiydi ve negatif
konumlardaydı:
```js
idTag: { marginBottom: -6 }              // etiket kartın içine giriyor
👑 { position:"absolute", top:-14 }      // taç etiketin üstüne biniyor
🪽 { left:-30 } / { right:-30 }          // kanatlar kırpılıyor
```
Yeni: koyu cam kart + altın kenar, taç **ikon madalyonu** olarak üst kenara
oturuyor ve `paddingTop` ile kendi boşluğu var. Kanatlar kaldırıldı.

### J. Kopyalama

`7d610d5` — Uygulamada **dört kopyalama ikonu** vardı, **hiçbiri panoya bir şey
yazmıyordu**. Üçü tıklanabilir bile değildi; `user-profile`'daki panoya
dokunmadan "Kopyalandı" yazıyordu.

`expo-clipboard` (~8.0.8) kuruldu, ortak `components/KopyaBtn.tsx` yazıldı.

### K. Yönetim (admin) ekranları

`4e833f8` — 10 ekranın 9'u aynı kahverengi zemindeydi; düz kartlar cam karta
çevrildi. Yönetim merkezinde özet + "Duyuru & Banner" sekme çubuğunun altındaydı
ve sekme değişince değişmiyordu → sekmelerin üstüne alındı. Kendi kopya sekme
çubuğu → ortak `Tabs`.

`b638c2c` — **Kullanıcı yönetimi baştan tasarlandı.** Dört bölüm (Ekonomi /
Ceza / Kimlik / Geçmiş) ayrı sayfaydı, geçiş için geri gidip tekrar girmek
gerekiyordu → aynı sayfada sekmeli.

Tek bir `chip` stili hem **seçim** (elmas/altın, ceza süresi, rol) hem **aksiyon**
(avatarı değiştir, hak ver, dondur) için kullanılıyordu. Üçe ayrıldı:
`Secim` / `Aksiyon` / `Anahtar`.

`1ce494b` — Süre seçenekleri serbest sarmalanıyordu (kimi 4+2 kimi 3+3,
genişlikler metne göre) → sabit 3 sütunlu ızgara. Mikrofon yasağına onay eklendi.

**Onay pencereleri** (geri alınamaz işlemler, hepsi tek dokunuşla çalışıyordu):
hesap yasağı, mikrofon yasağı, şifre sıfırlama.

`7daa631` — **Ara kullanıcı ekranı silindi** (`admin-user.tsx`). Bölümler sekmeli
olunca özet sayfası gereksizdi; kullanıcıya dokununca doğrudan sekmeli ekran.
Oradaki iki eylem (Mesaj/Uyarı, Herkese Açık Profil) başlığa taşındı.

`7daa631` — **Oda rapor detayı**: ekranın konusu rapordu ama dar bir satırdı,
tek eylemi sağ kenarda minik bir çipti. Belirgin kart + tam genişlikte iki
eylem: **Odaya Uyarı** (yeni — rapordan çıkmadan) ve **İncelendi**.

`e53e5d6` — **Yönetici düzenlemesi store'a yansımıyordu.** `patchCurrentRoom`
yalnız içinde olduğum odayı güncelliyor; yönetici düzenlerken odada değil.
Store'a `patchRoomByDbId` eklendi + `rooms:list` önbelleği düşürülüyor.
Oda kapağı yalnızca **gösteriliyordu**, değiştiren/kaldıran kontrol yoktu
(`admin_oda_guncelle` sadece ad+açıklama alıyor) → `053` + UI.

### L. "Bu odaya işlem yapıldı" (054)

`26036be` — Yönetici bir odaya işlem yaptığında yalnızca **yönetici loguna**
yazılıyordu; odada kalıcı durum yoktu. Sonuç: sahip işlem görmüş odayı
serbestçe düzenleyebiliyor (adını değiştirip izi kaybettirmek dahil), giren
kullanıcı hiçbir uyarı görmüyordu.

- DB: `islem_gordu` / `islem_sebep` / `islem_tarihi` + `admin_oda_islem_isaretle`
- **RLS**: `003`'teki `odalar_update` politikası yalnız sahipliğe bakıyordu →
  işaretli odada sahibin UPDATE'i engelleniyor (yönetici SECURITY DEFINER ile
  düzenlemeye devam eder, işareti kaldırabilir)
- `admin_oda_getir` dönüş imzası değiştiği için DROP + yeniden tanım
- UI: oda yönetiminde kırmızı uyarı + düzenleme kilidi; yönetim ekranında
  işaretle/kaldır; **oda listesinde filtre**

### M. Odaya giriş perdesi

`26036be` — `components/RoomEntryGate.tsx`. "Odaya giriliyor…" (oda kapağı, adı,
nabız halkası). İşlem görmüş odada uyarıya dönüyor: *"Bu odaya işlem yapıldı —
hemen ayrılmazsanız hesabınız da cezai işlem görebilir"* + sebep +
"Odadan Ayrıl" / "Riski kabul ediyorum".

### N. Alt sekme çubuğu

`4ec819c` — Cam kapsül iyiydi ama hareketsizdi. Aktif gösterge **kayıyor**
(260ms), seçili ikon yaylı animasyonla büyüyüp altın ışık alıyor. (Önceki tek
fark çizgi kalınlığıydı: 1.9 → 2.)

### O. Diğer düzeltmeler

- `d0473bf` — **`openMyRoom` oda kapağını kullanıcının avatarıyla eziyordu**
  (`photo: userPhoto || r.photo`), ayarlanan oda fotoğrafı her girişte siliniyordu.
- `d0473bf` — `patchCurrentRoom` `myRoom`'a dokunmuyordu → "Odam" kartı eski kalıyordu.
- `e53e5d6` — Canlı ayar aboneliği açıklamayı `|| undefined` yolluyordu:
  açıklama **silindiğinde** eski duyuru kalıyordu → `?? ""`.

---

## Yeni dosyalar

```
src/sheets/MicQueueSheet.tsx      Mikrofon sırası (tek amaçlı sayfa)
src/components/KopyaBtn.tsx       Panoya kopyalama düğmesi
src/components/RoomEntryGate.tsx  Odaya giriş perdesi + işlem uyarısı
db/migrations/052_oda_vitrin.sql        (ÇALIŞTIRILDI)
db/migrations/053_admin_oda_kapak.sql   (BEKLİYOR)
db/migrations/054_oda_islem_isareti.sql (BEKLİYOR)
```

**Silinen:** `src/app/admin-user.tsx`

**Yeni paket:** `expo-clipboard ~8.0.8`

**Yeni ikonlar** (`src/icons/paths.ts`): `hand`, `bank`, `wallet`

---

## Bilinen açıklar / sıradakiler

1. **`051`, `053`, `054` çalıştırılacak.**
2. **Oda rozet sistemi yok.** `Room.badges` yalnızca mock odalarda; DB'de tablo
   yok. Kullanıcı rozet sistemi (`049`) örnek alınabilir.
3. **Görev sistemi yok** — `data/tasks.ts` sabit demo.
4. **`RoomPanel`'de "Takip Et" yerel state** — hiçbir yere yazmıyor. Oda takibi
   diye bir şey yok; bu yüzden ana sayfadaki sekme "Katıldıklarım" (üyelik)
   olarak adlandırılmıştı, sonra "Resmî" ile değiştirildi.
5. **BottomNav DM sayısı önbellekten** — DM sekmesine bir kez girilmeden doğru
   değil. Açılışta `listThreads` prefetch edilebilir.
6. **`expo-video` cihazda denenmedi** (Expo Go'da olmayabilir → dev build).
7. **Splash Expo Go'da görünmüyor.**
8. Mevcut banner fotoğrafı eski oranda; yeniden yüklenmesi önerilir.

---

## Çalışma notları (ortam)

PowerShell 5.1 — bu oturumda tekrarlanan tuzaklar
(çalıştırma komutları için yukarıdaki **PROJEYİ ÇALIŞTIRMA** bölümüne bak):

- **Commit mesajı**: içinde `"` varsa native exe'ye argüman bozuluyor.
  Dosyaya yazıp `git commit -F <dosya>` kullan. Here-string'i `git commit -F -`
  ile boruya vermek de çalışmıyor.
- **UTF-8**: `Get-Content`/`Set-Content` çift kodlama yapıyor. Dosya düzenlerken
  `[System.IO.File]::ReadAllText/WriteAllText` + `UTF8Encoding($false)`.
- `Select-String -Recurse` yok; `-Path` ile dizin verilir.
- Konsol çıktısında Türkçe/emoji bozuk görünebilir — dosya bozuk sanıp
  "düzeltme" yapma, önce baytlara bak.
