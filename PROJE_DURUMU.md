# Proje Durumu — Aron Chat (Rn-ye-d-necegiz)

> **Bu dosyanın amacı:** Yeni bir AI sohbeti/oturumu başlatıldığında sıfırdan
> keşfe gerek kalmadan buradan devam edebilmek. Aşağısı projenin tamamının
> (frontend + backend + DB + ortam kısıtları + hedefler) döküm halidir.
> **Yeni sohbete bu dosyayı oku diye söyle, ya da içeriğini yapıştır.**
>
> Son güncelleme: bu dosyanın en altındaki "Şu An Kaldığımız Yer" bölümüne bak.

---

## 1) Proje Nedir

Türkçe bir **sesli sohbet odası (voice chat room) + sosyal akış** mobil
uygulaması — Clubhouse/Bigo/Yalla tarzı: kullanıcılar oda kurar, mikrofon
sırasına girer, hediye gönderir (ekonomi), profil/seviye/rozet sistemi,
DM, akış (feed), arkadaşlık, bildirimler, ve tam bir **yönetim paneli**
(developer/super_admin rolleri: kullanıcı yönetimi, oda yönetimi, denetim
izi, yasaklama, ekonomi müdahalesi, duyuru sistemi).

- **Repo:** `canjeinner-spec/Rn-ye-d-necegiz` (GitHub)
- **Geliştirme dalı:** `claude/metro-recovery-1xc2kq` (tüm işler bu dalda,
  henüz `main`'e merge edilmedi / PR açılmadı)
- **Dil:** Tüm kod, DB, commit mesajları **Türkçe** (snake_case DB, Türkçe
  değişken/tablo adları — bu bilinçli bir proje kararı, İngilizceye çevirme)

## 2) Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Mobil framework | Expo SDK ^54, React Native 0.81.5, Expo Router ~6.0.24 |
| Dil | TypeScript |
| State | Zustand (`src/store/appStore.ts` — tek merkezi store) |
| Backend | **Supabase** (Postgres + Auth + Realtime + Storage) |
| Supabase client | `@supabase/supabase-js` ^2.108.2 |
| Animasyon | react-native-reanimated ~4.1.1 |
| Liste/scroll native | react-native-screens ~4.16 (New Architecture açık) |
| Glass/blur | expo-blur, expo-glass-effect (iOS 26 Liquid Glass) |
| Bottom sheet | @gorhom/bottom-sheet |

## 3) Supabase Bağlantı Bilgileri

`.env` dosyasında (repoya commit edilmiyor, `.gitignore`'da — ama proje
sahibi olarak buraya not düşülüyor, bu **anon/publishable** anahtar,
istemciye gömülmesi güvenli tasarım gereği):

```
EXPO_PUBLIC_SUPABASE_URL=https://spsdbadmwnxofxotngqv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ONy5NfEra-Q9OK-fVKUUSw_PZDZL0ri
```

Proje ref'i: **`spsdbadmwnxofxotngqv`**. Supabase paneline
(supabase.com/dashboard) bu proje ref'iyle giriş yapılır. `service_role`
(secret) anahtar hiçbir yerde repoda tutulmuyor — SQL Editor'dan manuel
migration çalıştırılıyor (bkz. §6).

Yeni bir ortamda ilk kurulum: `.env.example`'ı `.env` olarak kopyala, yukarıdaki
değerleri gir.

## 4) Mimari / Klasör Yapısı

```
src/
  app/                  → Expo Router sayfaları (dosya = rota). 48 ekran.
    (tabs)/             → Alt tab bar: index (Odalar/Home), rank, feed, dm, profile
    admin*.tsx          → Yönetim paneli ekranları (10+ dosya, developer/super_admin)
    room.tsx            → Oda içi ekranı (sesli sohbet, mic, chat, hediye)
    onboarding.tsx       → Kayıt/giriş (telefon+kod / e-posta / Google)
    ...                  → Diğer tüm ekranlar (wallet, dm-chat, vip, store, vb.)
  sheets/               → Modal/bottom-sheet bileşenleri (ProfileCard, GiftSheet, vb.)
  components/           → Paylaşılan UI (BottomNav, Sheet, CenterModal, KeyboardAware, vb.)
  data/
    remote/             → Supabase repo katmanı (15 dosya) — TÜM DB erişimi buradan
    schema.ts           → Şema-birebir frontend tipleri
  store/appStore.ts     → Tek merkezi Zustand store (auth, rol, hesap yasağı, vb.)
  lib/features.ts       → MVP feature flag'leri (bkz. §7)
  theme/                → Renkler, gradient, glass panel
db/
  migrations/           → 001–048 sıralı SQL migration'lar (idempotent, tekrar
                           çalıştırılabilir — CREATE OR REPLACE / IF NOT EXISTS)
  HEPSI_020_048.sql     → 020'den 048'e kadar TEK YAPIŞTIRMA birleşik dosya
  SON_035_036_037.sql   → Sadece 035-036-037 için ayrı çalıştırma dosyası
  schema_v7_eklentileri.sql → v7 temel şemaya (Supabase'te zaten var, bu repoda
                           dosyası yok) eklenen ilk ek tablolar/kolonlar
```

**Önemli mimari kural:** Hiçbir ekran doğrudan `supabase.from(...)` çağırmaz;
her şey `src/data/remote/*Repo.ts` üzerinden gider (adminRepo, roomsRepo,
walletRepo, dmRepo, feedRepo, vb.). Yeni bir DB özelliği eklerken önce ilgili
repo dosyasına fonksiyon eklenir, sonra ekran ona bağlanır.

**Auth/rol modeli:** `appStore.ts` tek kaynak. `role` alanı `user | developer |
super_admin`. `hesapYasak` state'i doluysa tam ekran engel + force logout
(`enforceAccountBan()`). Realtime ile yasaklamalar anlık algılanır (037
migration).

## 5) Yapılanlar — Kronolojik Büyük Fazlar

Tüm commit geçmişi `git log --oneline --reverse` ile eksiksiz görülebilir.
Özet fazlar (eskiden yeniye):

1. **Frontend mockup (ilk faz):** Tüm ekranlar sahte/mock veriyle inşa edildi
   — oda listesi, oda içi, akış, profil, DM, ekonomi ekranları (cüzdan,
   mağaza, VIP, para çek), sosyal (arkadaşlar, ziyaretçiler, etkinlikler,
   davet), görevler, seviye, özel ID, yayıncı paneli, admin ekranları iskeleti.
2. **Backend Faz 0-1:** Supabase iskelesi, Auth (e-posta + Google OAuth,
   Expo Go uyumlu PKCE akışı), profil senkronu.
3. **Faz 2 (Odalar & Akış):** Gerçek oda listesi/açma, akış paylaşım/beğeni/
   yorum/yanıt/sabitleme/silme (hepsi DB'ye bağlı, SECURITY DEFINER RPC'lerle
   soft-delete).
4. **Faz 3 (Sosyal):** Gerçek DM + Realtime, bildirimler (Realtime), takip
   sistemi, ziyaretçiler.
5. **Faz 4 (Oda içi canlı):** Gerçek oda sohbeti + presence (Realtime),
   mikrofon sırası (broadcast, host onayı).
6. **Ekonomi temeli:** Gerçek cüzdan (elmas + altın), XP/seviye sistemi.
7. **Moderasyon "dilim 1-18" serisi** (en büyük blok): oda üyeliği/rolleri,
   kalıcı oda yasaklama, rapor sistemi (kullanıcı/oda/mesaj şikayeti), in-app
   yönetim paneli, platform mic-yasağı, admin kullanıcı arama/detay, rapor
   detayı (oda katılımcı anlık görüntüsü + giriş/çıkış kaydı), akış içerik
   denetimi, **denetim izi (audit log)**, varlık dondurma (elmas/altın),
   **hesap yasağı** (tam ekran engel + force logout + Realtime canlı tespit),
   e-posta değiştirme, oda düzenleme (ad/açıklama/ID — developer yetkisiyle).
8. **Stabilizasyon:** Auth güvenilirliği (tek kaynak state + root AuthGate),
   cache-first veri katmanı (tüm ekranlara yayıldı, gecikme azaltma), canlı
   ban tespiti sağlamlaştırma.
9. **Oda içi düzenleme + duyuru sistemi:** Oda tema/kapak/isim/duyuru kalıcı
   + gerçek parola (hash'li), **duyuru & sistem mesajı altyapısı** (dinamik
   banner + DM resmi/sistem hesabı), banner'lar tam sayfa premium şablona
   (duyuru/bakım/etkinlik JSONB içerik) çevrildi, **kişiye & odaya özel
   mesaj/uyarı** (hedefli sistem mesajı) eklendi.
10. **Tab bar cilası + Android klavye düzeltmesi (en son iş, bu oturumda):**
    - Sekmeler arası hızlı geçişte **siyah ekran bug'ı** giderildi
      (`animation:"fade"` → `"shift"` + `freezeOnBlur:false`,
      `src/app/(tabs)/_layout.tsx`).
    - **iOS 26 Liquid Glass** tab bar (`expo-glass-effect`'in `GlassView`'i,
      `isLiquidGlassAvailable()` ile güvenli fallback → Android/eski iOS'ta
      eski BlurView kapsül aynen kalıyor). Altın kapsül tasarımı korunuyor.
      (`src/components/BottomNav.tsx`)
    - **Android klavye input'u kapatma sorunu** düzeltildi — kök neden: Expo
      SDK 54 edge-to-edge varsayılanıyla `KeyboardAvoidingView`
      `behavior={undefined}` Android'de artık işlevsiz kalıyordu. Yeni
      paylaşılan **`src/components/KeyboardAware.tsx`** (`behavior:"padding"`)
      yazıldı ve şu dosyalara uygulandı: dm-chat, room, support, withdraw,
      onboarding, `CenterModal`, `Sheet` (→ SecuritySheet vb.), `ProfileCard`,
      admin-user-edit, admin-room-edit. `feed.tsx`'te satır-içi yorum
      input'ları için `automaticallyAdjustKeyboardInsets`.
    - Commit: `3f592d4` (push'landı).

## 6) Veritabanı — Migration Listesi (db/migrations/, 001-070)

Hepsi **idempotent** (`CREATE OR REPLACE`, `IF NOT EXISTS`) — tekrar
çalıştırmak zarar vermez. Sırayla çalıştırılmalı (numaraya göre).

| # | Dosya | Ne yapar |
|---|---|---|
| 001-020 | auth_bridge, ensure_profile, rooms_rls, storage_avatars, feed_rls, feed_likes_comments, feed_post_manage, post/comment_delete_rpc, dm_rls, room_chat(+fix), notifications, reply_notif, owner_comment_delete, clean_public_ids, follow, visitors, block, delete_account | Temel auth/profil/oda/akış/DM/bildirim/takip/engelleme altyapısı |
| 021 | oda_uyeleri | Oda üyeliği + oda içi roller |
| 022 | oda_yasaklari | Kalıcı oda yasaklama |
| 023 | raporlar | Şikayet/rapor sistemi |
| 024-025 | platform_rol, rol_enum_degerleri | Platform rolleri (user/developer/super_admin) |
| 026 | xp | Seviye/XP sistemi |
| 027 | cuzdan | Gerçek cüzdan (elmas + altın) |
| 028 | mic_yasak | Platform mic-yasağı |
| 029 | admin_kullanici | Admin kullanıcı arama/detay RPC'leri |
| 030 | sikayet_katilimci | Rapor anındaki oda katılımcı anlık görüntüsü |
| 031 | admin_icerik | Akış içerik denetimi (admin gönderi sil) |
| 032 | oda_hareket | Oda giriş/çıkış log'u |
| 033 | yonetici_islem | **Denetim izi (audit log)** — kim/hedef/işlem/ne zaman |
| 034 | dondurma | Elmas/altın varlık dondurma |
| 035 | hesap_yasak | **Hesap yasağı** (tam ekran engel + force logout) |
| 036 | oda_yonet | Oda düzenleme (ad/açıklama/ID, developer yetkisi) |
| 037 | realtime_yasak | Yasak tablolarını Realtime yayınına ekler (canlı ban tespiti) |
| 038 | admin_kimlik | Rol atama developer-only; ad/avatar düzenleme tüm yöneticiler |
| 039 | oda_ayar | Oda parolası (gerçek, hash'li, pgcrypto) + odalar Realtime |
| 040 | oda_grant_fix | `odalar` UPDATE grant'ını yeniden assert eder (tema/kapak fix) |
| 041 | duyuru_sistem | Sistem duyuruları (DM resmi/sistem kanalı) + banner altyapısı |
| 042 | banner_sablon | Banner'lar tam sayfa premium şablon (JSONB içerik) |
| 043 | hedefli_mesaj | Kişiye/odaya özel sistem mesajı/uyarı (hedefli) |
| 044 | ozel_id | **Özel ID sistemi** — `ozel_id`/`ozel_id_tip`/`ozel_id_tema`/`beta_tester`/`premium_hak`; `ozel_id_ayarla/kaldir` (entitlement+basamak+benzersizlik zorlar), `admin_hak_ata` |
| 045 | public_id_9hane | `yeni_public_id()` → 9 hane (özel ID ≤7 nadir kalsın) |
| 046 | beta_kapsul_dm | Beta + özel-id yok → otomatik hedefli Sistem DM hatırlatması (bir kez) |
| 047 | ozel_id_admin | `admin_kullanici_haklar` (oku) — admin-user'da beta/premium hak ver-al |
| 049 | rozet_sistemi | Rozet kataloğu (62 rozet) + `rozet_metrikleri` + `rozetleri_degerlendir/ver/al` + `kullanici_rozetleri_getir` ✅ |
| 050 | rozet_kusanma | `kullanicilar.kusanilan_rozet` + `profiller` view + oda/başarı kategori ayrımı + `rozet_kusan/kaldir` ✅ |
| 051 | rozet_kusanma_kurallari | Seviye rozetlerini sunucuda reddeder ⏳ **BEKLİYOR** |
| 052 | oda_vitrin | `odalar.resmi` + `gunluk_sira` (Daily Top) + `oda_vitrin_ayarla` (yalnız yönetici) ✅ |
| 053 | admin_oda_kapak | `admin_oda_kapak_ayarla` — yönetici oda kapağını değiştirir/kaldırır ⏳ **TEK BEKLEYEN** |
| 054 | oda_islem_isareti | `odalar.islem_gordu/islem_sebep/islem_tarihi` + `admin_oda_islem_isaretle`; **`odalar_update` RLS'i işaretli odada sahibi engeller**; `admin_oda_getir` DROP+yeniden ✅ |
| 055-066 | (bkz. dosya adları) | oda listeleri, eşya/mağaza, hediye defteri, sıralama, görevler, tek altın bakiyesi, enum/yetki düzeltmeleri, oda listesi canlı yayın, oda rozetleri ✅ |
| 067 | admin_bakiye_temel_deftere | Yönetici bakiyesi + panel okuması temel deftere (`lot_yatir`/`lot_harca`, `cached_*`) ✅ |
| 068 | oda_koltuklari | Koltuk/mikrofon/kilit **var olan** `oda_koltuklari` tablosuna; RPC + realtime + RLS ✅ |
| 069 | mic_akislari | `koltuktan_indir`, `oda_mic_sirasi` tablosu, sıraya gir/çık/onayla, mic yasağı sunucuda ✅ |
| 070 | oda_katilimcilari | `oda_katilimcilar` + kalp atışı devreye alındı; `oda_kisi_sayilari` ✅ |
| 071 | mic_sirasi_koltuk_secimi | `mic_sirasi_onayla(oda, hedef, koltuk DEFAULT NULL)` — onaylayan koltuğu seçebiliyor (eski 2-arg sürüm DROP) ✅ |
| 072 | oda_moderatoru_sozluk | `_oda_moderatoru` YANLIŞ sözlüğe bakıyordu (`yonetici/moderator` ölü enum değerleri) → `('sahip','yardimci')`; yardımcının mic yetkileri sunucuda ilk kez çalışıyor ⏳ |
| 073 | koltuk_yarislari | `koltuga_otur`/`mic_sirasi_onayla` koşullu yazma + ROW_COUNT; yarışta sessiz ezme yerine 'Koltuk dolu.' ⏳ |
| 074 | odul_ve_satinalma_yarislari | `esya_satin_al` kullanıcı satırı kilidi; `gunluk_giris_al` ilk-gün çift ödül kapandı ⏳ |
| 075 | admin_eposta_kisiti | e-posta yine yalnız `ben_developer()` — 038'de düşen 029 kısıtı geri ⏳ |
| 076 | search_path_pg_temp | `oda_ziyaret_kaydet`'e eksik `pg_temp` ⏳ |
| 077 | anon_grant_supurme | 021-024 fonksiyonlarına `FROM PUBLIC, anon` süpürmesi + doğrulama sorgusu ⏳ |
| 078 | oda_mesaj_rpc | `oda_mesaj_yaz` RPC (mic/oda yasağı sunucuda); 011'in doğrudan INSERT grant'i kapandı; sohbet artık kalıcı ⏳ |
| 079 | sayac_emekliligi | `oda_katilimci_yaz` no-op; `siralama_odalar`/`admin_oda_getir` canlı sayıma geçti; bayat değerler 0'landı ⏳ |
| 048 | hesap_yasak_dm | `hesap_yasak_ver/kaldir` OR REPLACE → yasak verilince/kalkınca hedefe kalıcı **Sistem DM'i** (sebep+süre; yasaklı ancak yasağı kalkınca görür) + bildirim |

**Birleşik dosyalar:**
- `HEPSI_020_048.sql` — 020'den 048'e kadar hepsi tek yapıştırmada (025 önce,
  tek başına çalıştırılmalı — enum değeri ekleme kısıtı).
- `SON_035_036_037.sql` — sadece bu üçü ayrı çalıştırmak için.

**Temel şema (bu repoda dosyası yok, Supabase'te zaten kurulu):** `kullanicilar`,
`odalar`, `gonderiler` (akış), vb. — `schema_v7_eklentileri.sql` bunların
üstüne ek kolon/tablo ekliyor (feed, etkinlik, görev, kupon, özel ID,
arkadaşlık için).

## 7) Feature Flag'leri (`src/lib/features.ts`) — 28 Ağustos'ta HEPSİ AÇILDI

Bayrakların **hepsi artık `true`** (28 Ağustos, kullanıcı isteği: "clientten
gizlediğimiz her şeyi aktif eder misin"). Ekranlar/rotalar zaten yerindeydi,
yalnızca girişleri gizliydi.

```
roomGift · streamerPanel · giftHistory · giftCoupon · store · vip
rankTab · inventory · friends · events · notifications · visitors
profileGift · dmGift            → 14 bayrak, tamamı true
```

> **⚠️ Açık olmak, gerçek olmak değil.** Aşağıdakiler artık **görünür ve
> gezilebilir** ama arkalarında ne tablo ne RPC var — gerçek bir iş yapmazlar:
>
> | Bölüm | Durum |
> |---|---|
> | store / vip / inventory | sabit ürün listeleri; satın alma yok |
> | agency-panel (yayıncı) | sabit kazanç/ajans sayıları |
> | gift-history | sabit geçmiş |
> | friends / events | `data/friends.ts`, `data/events.ts` (sabit) |
> | rank sekmesi | `data/seed.ts` → RANKS / AGENCY_RANKS / STREAMER_RANKS |
> | hediye gönderme (roomGift / dmGift / profileGift) | animasyon oynar ama **bakiye düşmez**, alıcıya bir şey geçmez, kayıt tutulmaz |
> | giftCoupon | kupon tablosu yok; ekran artık ödül verdiğini iddia etmiyor |
>
> **Gerçek olan:** `visitors` (visitRepo) ve `notifications` (Faz 3).

Gerçeğe bağlamak için sırasıyla: hediye kataloğu + bakiyeden düşen **atomik**
gönderim RPC'si → envanter tablosu → ajans/yayıncı tabloları → sıralama
görünümleri (materialized view + zamanlanmış yenileme).

## 8) Bilinen Ortam Kısıtları + Tünel

> ### ⚠️ ORTAM DEĞİŞTİ — bu bölümün altı ESKİ ortama ait
>
> Proje artık **bulut sandbox'ta değil**, bir **Windows makinesinde** çalışıyor
> (aşağıda görüleceği gibi bu makine de uzak bir bulut sunucusu — telefon
> aynı ağda DEĞİL).
> **Proje yolu:** `C:\Users\Administrator\Desktop\Rn-ye-d-necegiz`
> (28 Ağustos'ta `C:\dev\Rn-ye-d-necegiz`'den taşındı; `C:\dev` boş kaldı.)
>
> **⚠️ BU MAKİNE BİR BULUT SUNUCUSU — tünel ZORUNLU** (28 Ağustos'ta anlaşıldı).
> Dış IP `13.62.50.3` (AWS Stockholm); yerel adres `172.31.21.78` bir VPC
> adresi ve telefonun oraya ulaşması **fiziksel olarak mümkün değil** — QR
> kod çalışmaz. Expo Go host'a erişemeyince sol altta **"Downloading..."
> yazıp donar**; bu belirtiyi görürsen sebep budur, Metro'da sorun yoktur.
> (Burada önceden "telefon aynı ağdaysa QR yeterli" yazıyordu — yanlıştı.)
>
> **Çalıştırma — üç adım (ilk ikisi ayrı kabuklarda):**
> ```powershell
> # 1) Tünel — cloudflared artık kalıcı: .tools\cloudflared.exe (.gitignore'da)
> & "$env:USERPROFILE\Desktop\Rn-ye-d-necegiz\.tools\cloudflared.exe" tunnel --url http://localhost:8081 --no-autoupdate
> #    çıktıdan https://<ad>.trycloudflare.com adresini oku
>
> # 2) Metro — tünel adresiyle
> $env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:Path"
> cd "$env:USERPROFILE\Desktop\Rn-ye-d-necegiz"
> $env:EXPO_PACKAGER_PROXY_URL = "https://<ad>.trycloudflare.com"
> $env:REACT_NATIVE_PACKAGER_HOSTNAME = "<ad>.trycloudflare.com"
> npx expo start --clear
> ```
> **3) Telefonda:** Expo Go → "Enter URL manually" → `exp://<ad>.trycloudflare.com`
> QR'a bakma, o hâlâ ulaşılamayan yerel adresi gösterir. İlk bundle ~60 sn
> (1074 modül, 5.8 MB), sonrası hızlı. **Adres her yeni tünelde değişir** —
> quick tunnel kalıcı ad vermez.
>
> **PATH sorunu:** `npx`, `git`, `node` PATH'te **değil**. Her yeni kabukta:
> ```powershell
> $env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:Path"
> ```
> **Tip kontrolü:** `node node_modules\typescript\bin\tsc --noEmit`
> (`npx tsc` çalışmaz.)
>
> **Port 8081 doluysa** — Metro'nun ölü süreçleri kalabiliyor:
> ```powershell
> Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*Rn-ye-d-necegiz*" } |
>   ForEach-Object { "PID {0}  {1}" -f $_.ProcessId, $_.Name }
> taskkill /PID <metro-pid> /T /F
> ```
> Metro `expo start` → `cmd` → `node .../expo/bin/cli` → 3 × `jest-worker`
> zinciri açar; `/T` hepsini birden kapatır. **Klasörü taşımadan/silmeden önce
> Metro'yu kapat** — açıkken dosya kilidi verir (28 Ağustos'ta taşırken yaşandı).
>
> **Bu makinede tünel denemeleri (28 Ağustos):**
>
> | Yöntem | Sonuç |
> |---|---|
> | `EXPO_FORCE_WEBCONTAINER_ENV=1` (Bolt) | ❌ **502.** Aşağıda "çalışıyor" yazan bu yöntem YEREL makinede çalışmıyor: değişken Expo'ya "tüneli platform sağlıyor" dedirtiyor, ama burada sağlayan yok. `Get-NetTCPConnection -OwningProcess` ile bakıldı — Metro'nun **hiç giden bağlantısı yoktu.** |
> | `npx expo start --tunnel` (ngrok) | ❌ `CommandError: TypeError: Cannot read properties of undefined (reading 'body')` — iki kez. `@expo/ngrok` kurulu ama çalışmıyor. Kullanıcı "ngrok deneme" dedi. |
> | **cloudflared quick tunnel** | ✅ **Tek çalışan yöntem.** 28 Ağustos'ta `.tools\cloudflared.exe` olarak kalıcı indirildi (52 MB, sürüm 2026.8.2). `.gitignore`'da — repoya girmiyor (`7bbfbaa`). |
>
> Komutlar için yukarıdaki "Çalıştırma — üç adım" bloğuna bak. Ortam
> değişkenleri sistemde kalıcı **değil**, her yeni kabukta yeniden verilir.

**Aşağısı, proje bulut sandbox'ta geliştirilirken geçerliydi — tarihsel kayıt:**

Proje **Expo SDK 54** ile başlatıldı ve **Claude Code on the web** (bulut
sandbox) üzerinde geliştiriliyordu. Kullanıcının fiziksel telefonu o sandbox'a
**tünel olmadan doğrudan bağlanamıyordu**. İki mekanizma denenmişti:

### ✅ ÇALIŞAN komut — "Bolt" (Expo'nun kendi WebSocket tüneli)

```bash
EXPO_FORCE_WEBCONTAINER_ENV=1 npx expo start
```

**`--tunnel` bayrağına GEREK YOK** — `EXPO_FORCE_WEBCONTAINER_ENV=1` tek
başına yeterli (nedeni aşağıda). Bu ortamda **doğrulandı ve çalışıyor**:
- Metro şunu basıyor: `Waiting on http://<rastgele-alt-alan-adı>.boltexpo.dev`
- O alt alan adına gerçek `curl` isteği → **200 OK, ~180ms**.
- Gerçek uygulama bundle'ı (6.2MB) o URL üzerinden **2 saniyede** indi —
  uçtan uca doğrulandı, sadece "URL basıyor" değil, gerçekten çalışıyor.
- Expo Go'da açılacak bağlantı: Metro'nun bastığı `http://` adresindeki
  şemayı `exp://` yap → **`exp://<alt-alan-adı>.boltexpo.dev`**
  (her yeni `expo start` çalıştırmasında alt alan adı DEĞİŞİR, o session'da
  Metro'nun bastığı satırdan oku).

**"Bolt" tam olarak nedir:** ngrok değil — Expo CLI'nin kendi içinde gizli
bir mekanizma. `@expo/cli`'nin `BundlerDevServer.js` dosyasında:
```js
if (hostType === 'tunnel' && ...) { tünel başlat }
else if (envIsWebcontainer()) { tünel başlat }   // ← --tunnel'dan BAĞIMSIZ çalışır!
...
this.tunnel = envIsWebcontainer()
  ? new AsyncWsTunnel(...)   // "Bolt" — wss://boltexpo.dev
  : new AsyncNgrok(...);     // varsayılan — ngrok
```
`envIsWebcontainer()` → `EXPO_FORCE_WEBCONTAINER_ENV=1` env değişkeniyle
tetiklenir ve `--tunnel` bayrağından TAMAMEN BAĞIMSIZ olarak da tüneli
başlatır (`else if` kolu). Normalde StackBlitz gibi tarayıcı-içi WebContainer
ortamları için var; ngrok binary/hesap gerektirmiyor, bu yüzden kısıtlı ağlarda
ilk denenecek/tercih edilecek yöntem.

### ❌ ÇALIŞMAYAN komut — ngrok (Expo'nun varsayılanı)

```bash
npx expo start --tunnel
```
"ngrok tunnel took too long to connect" hatasıyla düşer ve **Metro'yu da
beraberinde götürür**. Kök neden: sandbox'ın zorunlu egress proxy'si ngrok'un
sertifika-pinning'ini desteklemiyor (`/root/.ccr/README.md` açıkça
"desteklenmiyor, atlatmaya çalışma" diyor). **Bolt çalıştığı için buna hiç
gerek yok, bu komutu bir daha deneme.**

### Özet — üç komut, ne zaman hangisi

```bash
# Telefonla/cihazla dışarıdan bağlanmak için — BUNU KULLAN:
EXPO_FORCE_WEBCONTAINER_ENV=1 npx expo start

# Sadece bu sandbox içi hızlı doğrulama (tsc/bundle), dışarıdan görünmez:
npx expo start --clear

# ngrok — bu sandbox'ta ÇALIŞMAZ, denemeye gerek yok (Bolt zaten çalışıyor):
npx expo start --tunnel
```

Kullanıcının kendi bilgisayarında çalıştırırken (`claude --teleport` ya da
`git pull` sonrası) zorunlu egress proxy'si olmadığı için ngrok (`--tunnel`,
varsayılan) da sorunsuz çalışır — orada Bolt'a gerek yok, ama Bolt komutu
oradan da çalışır (evrensel, Expo'nun resmi CLI'sinde yerleşik).

## 9) Ertelenen / Bilinçli Olarak Yapılmayan İşler

- **Oda ekonomisi (harcanan altın + oda sıralaması):** Gifting/hediye→altın
  harcama sistemi tamamen mock olduğu için ERTELENDİ. Gerçek hediye→oda→altın
  defteri kurulunca (yukarıdaki feature flag'ler açılınca) eklenecek.
- **XP/seviye kuralları:** Temel XP sistemi var (026 migration) ama detaylı
  kurallar (hangi aksiyon kaç XP verir vb.) kullanıcı kararını bekliyor
  (dilim 6 notunda belirtilmiş, hâlâ açık).
- Yukarıdaki §7'deki tüm `false` feature flag'ler = bilinçli olarak MVP
  dışında bırakılan, ama kodu hazır duran özellikler.

## 9.5) Rozet Sistemi (Premium PNG Setleri) — Güncel Durum

Tüm rozetler kullanıcının **kendi ürettiği gerçek sanat eseri** (GPT görselleri),
Node+pngjs ile piksel-hassas kırpılıp `assets/badges/` altına konur. **ASLA
elle SVG çizilmez** — kullanıcı bunu açıkça reddetti.

### Klasör düzeni (`assets/badges/`)
- `level/` (6): level_bronze/silver/gold/platinum/diamond/legendary — seviye rütbeleri.
- `role/` (7): developer, super_admin, admin, moderator, streamer, vip, vip_hukumdar.
- `special/` (1): beta_tester.
- `room/` (36): hiyerarşik oda rozetleri (weekly_champion, room_owner, legendary…).
- `idcard/` (25): **kapsül** tema kartları (bronze…star) — 6-7 hane özel ID.
- `premium/` (60): **premium** hazır banner'lar (ID baked) — ≤5 hane özel ID.
- `nameplate/` (30): eski nameplate çerçeveleri — özel ID'de artık KULLANILMIYOR.

### Aşama 1 — level/role/special NORMALİZE edildi (BU OTURUM)
Sorun: her rozetin içeriği tuval içinde farklı boyut/konumdaydı (dolgu %74–100,
dikey merkez 0.44–0.54) → "bazı büyük bazı küçük, VIP bir tık üstte". Çözüm:
`scratchpad/normalize-badges.js` her PNG'yi gerçek içerik bbox'ına trim eder,
ortalar, uzun kenarı tuvalin **%90'ına** ölçekler. Sonuç: hepsi merkez
(0.500, 0.500), tek standart dolgu. **Bu script yalnızca level/role/special'a
uygulandı; oda rozetleri (room/) kullanıcı isteğiyle şimdilik dokunulmadı.**
Yeni bir sheet kırpılırsa bu normalize adımı standart olmalı.

### Aşama 2 — Özel ID nameplate sistemi (BU OTURUM — TEMEL kuruldu)
- Kaynak: 6×5 = 30 çerçeve sheet'i (`9b259511-…png`, 1672×941).
- Kırpma: `scratchpad/nameplates/crop.js` — **kenar flood-fill** ile yalnızca
  dış siyah boşluğu şeffaf yapar (luminance chroma-key DEĞİL — o, iç koyu
  paneli delerdi). En-boy korunur (~3:1), genişlik 1000px'e normalize.
- Bileşen: `src/components/IdNameplate.tsx` — `<IdNameplate frame text width/>`
  çerçeveyi çizer + metni iç panele oturtur (`adjustsFontSizeToFit`, displayBold,
  gölge). İç panel dikdörtgeni frame'e göre oran olarak tanımlı; soldaki
  madalyonlu 5 çerçevede (01,02,03,11,23) metin sağa kayar.
- **YAPILACAK (sonraki oturum):** (a) her frame için iç-panel oranlarını cihazda
  görüp ince ayarla; (b) DB'ye "atanan nameplate" kolonu + admin-user'da atama
  UI; (c) profil/ID gösteriminde nameplate'i bağla. Şu an sadece `preview.tsx`
  galerisinde 30'u da örnek metinle görünüyor.

### Aşama 2b — ÖZEL ID HİYERARŞİSİ (BU OTURUM — NİHAİ DURUM)
Basamak sayısına göre iki katman (+düz). `src/data/specialId.ts` +
`src/components/OzelId.tsx` + `src/components/PremiumBanner.tsx`:

- **PREMIUM (≤5 hane):** 60 **hazır banner** — ÖZEL ID + numara GÖRSELE **baked**
  (üzerine yazı yazılmıyor). Kullanıcı **listeden seçer** (hakkı varsa).
  `assets/badges/premium/premium_01..60.png`. Bileşen `PremiumBanner frame width`
  + `PREMIUM_FRAMES` (60) + `PREMIUM_NUM` (baked numaralar, kopyalama/bilgi için).
  Kaynak `3346a73d-…png` (1536×1024, 6×10). Kırpma `scratchpad/premium/crop.js`:
  flood BG_T=22 (sadece siyah) + küçük-bileşen filtresi (kanat uçları KORUNUR).
- **KAPSÜL (6-7 hane):** 25 kart teması — amblem + temanın rengiyle **birebir
  uyumlu** hap içinde ID. `IdKapsul theme id` + `OZEL_ID_TEMA_RENK` (25 renk elle).
  `assets/badges/idcard/*.png` (900px). Kırpma `scratchpad/idcards/crop.js`:
  flood BG_T=**20** (koyu çerçeveler şeytan/gölge/doğa YENMEZ), luminance rampası
  YOK (yarı-saydamlık olmasın), küçük-bileşen filtresi (ayraç noktaları) +
  `cardBottom` (etiket kesimi). Kaynak `4aaa47e0-…png`.
- **8+ hane:** düz numara. (Yeni kayıtlar 9+ hane olacak — YAPILACAK.)
- Yardımcılar: `ozelIdTier(id)`, `idBasamak(id)`, `OZEL_ID_KARTLARI` (25),
  `OZEL_ID_KART_ADI`, `OZEL_ID_TEMA_RENK`. Eşik: `OZEL_ID_KART_MAX=5`,
  `OZEL_ID_KAPSUL_MAX=7`. **Not:** eski pazar/tier (super/t1/t2, THRONE_*) KORUNDU.
- **appStore (demo — DB alanı YOK, sonraki iş):** `ozelId` (numara) +
  `ozelIdTip` ("premium"/"kapsul") + `ozelIdTema` (banner ya da kart anahtarı) +
  `setOzelIdKimlik(id,tip,tema)`.
- `OzelIdGosterim id tip tema` → premium: PremiumBanner görseli · kapsul: IdKapsul.
- **special-id.tsx** `KapsulBolumu`: tip seç → Kapsül: ID gir (6-7) + kart teması ·
  Premium: listeden banner seç (ID baked). Canlı önizleme + **Onayla** →
  `setOzelIdKimlik`. Zaten varsa **Değiştir/Kaldır**. Eski "Özel ID Havuzu"
  (sabit chip'ler) KALDIRILDI.
- **profile.tsx:** düz "ID:" satırı yerine **özel ID** (premium width 88 /
  kapsül size 8) + kopyalama ikonu; tıkla → **OzelIdInfoModal** (bilgi penceresi,
  sayfaya gitmez). `betaTester && özel-id yok` → yönlendirme banner'ı →
  `/special-id` (alınca kaybolur). **Ajans rozeti** vitrinden kaldırıldı.
- **Sağ '>' oku** → `/user-profile?self=1` (kendi profilini PUBLIC görünümde
  önizle). user-profile **self** modda: aksiyon barı gizli, ajans/streamer rozeti
  yok, **yetki rozeti** (developer/super_admin) DB `ekonomi_rolu`'ndan (self için
  store rolü) EN BAŞTA, düz ID yerine özel ID.

### Aşama 3 — Bilgi pencereleri (BU OTURUM — NİHAİ)
- `BadgeInfoModal.tsx` (PngBadge tıkla) + `OzelIdInfoModal.tsx` (özel ID tıkla):
  liquid-glass, **baya saydam**, küçük (rozete göre boyut), **buton YOK**;
  birkaç saniye (`AUTO_MS`) ya da **herhangi dokunuşta** kapanır; **FadeIn ile
  aydınlanarak** açılır, Modal fade ile **kararak** kapanır. Font/metne dokunulmadı.
- `PngBadge` kendi kendine tıklanabilir; `src/data/badgeInfo.ts` metin kaynağı.

### Artık KULLANILMAYAN (özel ID için) — temizlenebilir
- `assets/badges/nameplate/` (30) + `IdNameplate.tsx`: premium 60 baked banner'a
  geçince özel ID'de kullanımdan kalktı; yalnızca `preview.tsx` galerisinde duruyor.
- `OzelIdKart` bileşeni (kart üstüne ID plakası): premium için artık yok; kart
  GÖRSELİ sadece kapsül tema-seçici thumbnail'lerinde + IdKapsul ambleminde.

### Aşama 2c — ÖZEL ID DB KALICILIĞI (BU OTURUM — backend bağlandı)
Frontend demo'su gerçek DB'ye bağlandı. Migration'lar (kullanıcı Supabase SQL
Editor'ünde çalıştırır; birleşik: `HEPSI_020_046.sql`):
- **`044_ozel_id.sql`:** `kullanicilar`'a `ozel_id` (benzersiz, kısmi index) +
  `ozel_id_tip` (CHECK premium/kapsul) + `ozel_id_tema` + `beta_tester` +
  `premium_hak`. `profiller` view'i özel ID kolonlarıyla yeniden. RPC'ler:
  `ozel_id_ayarla(id,tip,tema)` (SECURITY DEFINER — **entitlement + basamak +
  benzersizlik ZORLAR**: premium→premium_hak & ≤5 hane, kapsul→beta/premium & 6-7
  hane, ID hem public_id hem ozel_id'de benzersiz), `ozel_id_kaldir()`,
  `admin_hak_ata(hedef,alan,deger)` (yalnız yönetici + `_yonetici_log`).
- **`045_public_id_9hane.sql`:** `yeni_public_id()` → 9 hane (backfill YOK). 9+ ile
  ≤7 çakışmaz → arama iki kolonu da eşler.
- **`046_beta_kapsul_dm.sql`:** `beta_kapsul_hatirlatildi` bayrağı +
  `beta_kapsul_hatirlat()` RPC → beta && özel-id yok && daha atılmadıysa
  `sistem_duyurulari`'na hedefli 'sistem' mesajı (kullanıcının **Sistem DM**
  thread'inde görünür, 043 mekanizması) + bildirim; bir kez.
- **Repo (`profileRepo.ts`):** Profile/PublicProfile'a özel-id kolonları;
  `setOzelId/clearOzelId/betaKapsulHatirlat` RPC sarmalayıcıları; `searchProfiles`
  artık `ozel_id`'yi de arıyor.
- **Store:** `loadProfile` özel-id + beta_tester + premium_hak DB'den okur;
  beta+özel-id yoksa `betaKapsulHatirlat()` çağırır. `premiumHak` state eklendi.
- **special-id:** claim **yetki-kilitli** — hak yoksa "Özel ID hakkın yok",
  yalnız hak edilen tip sekmesi; Onayla → `setOzelId` RPC (hata gösterir); Kaldır
  → `clearOzelId`. Profildeki beta yönlendirme banner'ı **fallback** olarak kaldı.
- **Admin atama (TAMAM):** `047_ozel_id_admin.sql` `admin_kullanici_haklar` (oku)
  + 044 `admin_hak_ata` (yaz); `adminRepo.getUserHaklar/setUserHak`;
  `admin-user-edit` Kimlik bölümünde **"ÖZEL ID HAKLARI"** — Beta Tester /
  Premium Hak ver-al toggle'ları (yönetici). Birleşik: `HEPSI_020_047.sql`.
- **KALAN (küçük):** ✅ profildeki "Demo · Beta Tester" toggle'ı `2a8400b`'de
  kaldırıldı (artık DB'den geliyor). Açık kalan: Sistem DM mesajına tıklayınca
  /special-id derin-linki (şimdilik profil banner'ı yönlendiriyor).

## 10) Şu An Kaldığımız Yer

> **Son güncelleme: 2 Eylül 2026** · Dal `claude/metro-recovery-1xc2kq`
> · **origin'e PUSH EDİLMEDİ** · güncel commit için `git log --oneline -5`
> · Dal `claude/metro-recovery-1xc2kq` · **origin’e PUSH EDİLMEDİ**
> (yerel commit’ler; şema dökümü için `db/SEMA_DOKUMU.md`’ye bak)

### 🟡 ODA LİSTESİ GÖRÜNÜRLÜĞÜ — karar verildi + düzeltildi, CİHAZDA DOĞRULANMADI

> **DÜZELTME (30 Ağustos, aynı gün, üçüncü tur):** "tek kaynak seç" kararı
> UYGULANMADI — çünkü hem presence'ı hem sayacı tek başına seçmek aynı hataya
> yol açtı: **içinde insan olan oda listede boş göründü.** Presence tek söz
> sahibi yapılınca, presence bir odayı ıskaladığı anda (track gitmemiş, o
> istemci genel kanala katılmamış, ağ yavaş) o odanın DB sayacı da sıfıra
> EZİLİYORDU. Nihai kural: **iki kaynağın BÜYÜĞÜ** — iki bağımsız kaynaktan
> biri "burada insan var" diyorsa oda doludur. Yanlış tarafa düşme riski
> "hayalet oda"ya kayar, o da dolu odanın kaybolmasından çok daha zararsız.
> Ayrıca sayacı artık odadaki HER istemci yazıyor (eskiden yalnız en küçük
> uid — tek arıza noktasıydı).
>
> Boş odalar **yalnızca "Boş" sekmesinde**; bir ara Keşfet'e de konmuştu,
> kullanıcı istemedi ("her şey birbirine karışmış").

**İLK KARAR (aşıldı, kayıt için):** kişi sayısının **tek kaynağı presence**.
`odalar.aktif_katilimci_sayisi` SİLİNMEDİ — sıralama (060), "Odam"
(`getMyRoom`) ve yönetim ekranları (036/054) onu okuduğu için **istatistik**
olarak kalıyor ve `room.tsx` yazmayı sürdürüyor; ama artık **görünürlüğe
karar vermiyor**. İkinci karar: "boş odayı hiç gösterme" kuralı kaldırıldı —
boş odalar ayrı bir **"Boş" sekmesinde** listeleniyor.

> Not: sayacı tamamen sökmek mümkün değildi; üç yer daha ona bağlı
> (`060_siralama.sql:124`, `roomsRepo.getMyRoom`, `036`/`054`
> `admin_oda_getir`). "Birine karar ver, diğerini sök" bu yüzden
> "presence karar verir, sayaç istatistik kalır" şeklinde uygulandı.

**KÖK SEBEP (kod okumasıyla bulundu — üç turdur neden teşhis edilemediği):**
`odaVarlik.ts` her hatayı **sessizce yutuyordu**:
- `subscribe` geri çağrısı yalnız `"SUBSCRIBED"`e bakıyordu; `CHANNEL_ERROR` /
  `TIMED_OUT` **hiç görülmüyordu** ve **yeniden deneme yoktu** → kanal bir kez
  join edemezse `canliSayilar` sonsuza kadar boş kalıyordu.
- Üç ayrı `.catch(() => {})` (`track`/`untrack`) → track reddedilse iz kalmıyordu.
- Kanal, oturum daha kurulmadan `(tabs)/index.tsx` mount'unda açılıyordu.
- Presence anahtarı `String(uid ?? Math.random())` idi: kanal liste ekranından
  (uid bilinmeden) açıldığı için anahtar rastgele kalıyor, sonra düzelmiyordu.

Buna `index.tsx`'teki `canli === undefined ? r : …` eklenince (presence kaydı
yoksa sessizce DB sayacına düşüyordu) iki kaynak **tam o noktada** çelişiyordu.

**AYRICA — kanıt yorumu düzeltmesi:** `oda_katilimci_yaz` (057:34)
`benim_kullanici_id()` NULL ise **hatasız `RETURN`** ediyor. Yani eski nottaki
"`[sayac]` hata satırı hiç çıkmadı, demek ki yazma patlamıyor" çıkarımı
yazmanın çalıştığını **kanıtlamıyor** — sessiz no-op da aynı görünüyor.

**YAPILANLAR (bu oturum — `tsc --noEmit` temiz, commit'lenmedi):**
- **`src/data/remote/odaVarlik.ts` yeniden yazıldı:** her `subscribe` durumu
  loglanıyor (`[varlik]`), `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` sonrası artan
  gecikmeyle (1s→20s) yeniden bağlanma, `track`/`untrack` sonucu loglanıyor,
  presence anahtarı süreç boyunca sabit, dinleyiciye ikinci argüman **`hazir`**
  veriliyor (presence oturmadıysa çağıran DB sayacına düşer — soğuk açılış).
- **`src/app/(tabs)/index.tsx`:** `hazir` ise sayı YALNIZCA presence'tan gelir
  (kayıt yoksa oda gerçekten boştur, 0). Görünürlük filtresinden `r.online > 0`
  çıkarıldı; `uygun` (izin) / `gorunur` (dolu) / `bosOdalar` diye ayrıldı.
  **5. sekme "Boş"** eklendi (en son kurulan en üstte), boş-durum metinleri
  güncellendi.
- **`src/app/my-room.tsx`:** "Odam" satırındaki `myRoom.live` de presence'a
  bağlandı — "odanın içindeyken bile 'Şu an boş' yazıyor" ucu buydu.
- **`roomsRepo.ts`:** `[liste] … online:` teşhis logu `sayac:` olarak
  netleştirildi (o satır DB sayacıdır, presence değil — karıştırılmıştı).

**REGRESYON — asıl mesele buymuş (30 Ağustos, kullanıcı bildirdi):**
Kullanıcı "eskiden bayağı görünüyordu, sonradan bir oturumda bozdunuz" dedi;
git geçmişi bunu doğruluyor. `36802bc`'de liste HİÇ filtrelenmiyordu — her oda
her zaman görünüyordu. `393d66d` sekmeleri gerçekten çalıştırırken "içinde
kimse yoksa gösterme" kuralını getirdi, `99fd630` da bunu TÜM sekmelere yaydı.
Yeni kurulan oda böylece hiçbir yerde görünmez oldu (057'nin açılış notu tam
olarak bunu anlatıyor) ve sahibi kendi odasını bulamadı.

**Geri alındı.** Boş oda artık ana sekmeleri terk etmiyor:
Keşfet = her şey (dolu üstte) · Popüler = yalnız dolu · Yeni = yeni kurulanlar
(doluluk aranmaz, yeni oda tanımı gereği boştur) · Resmî = tüm resmî odalar ·
Boş = yalnız boşlar. Presence hâlâ "kim odada" sayısının tek kaynağı; artık
yalnızca SIRALAMAYI ve "Popüler"i etkiliyor, odayı listeden SİLMİYOR.

**Teşhis rozeti — KALDIRILDI (kullanıcı isteği).** Odalar ekranında presence durumu
+ "en son hangi odada kaç kişi görüldü" satırı. Tek cihazla presence'ı
doğrulamanın tek yolu bu — kendi odana girip listeye dönmek doğrulama DEĞİL,
çünkü listeye bakmak için odadan çıkman gerekiyor ve çıkınca presence'tan
düşüyorsun ("Küçült" de `router.back()`, `room.tsx:1212`).

**Kalan doğrulama — iki cihaz.** Metro logunda:
- `[varlik] kanal SUBSCRIBED` görünüyorsa → arkadaş odaya girince odası listede
  belirmeli, çıkınca "Boş" sekmesine düşmeli. Doğrulanınca `[varlik]`,
  `[liste]`, `[presence]` teşhis logları kaldırılabilir.
- `[varlik] kanal CHANNEL_ERROR …` görünüyorsa → **artık sebebi yazıyor.**
  Presence'ın hiç çalışmamasının kökü orasıdır; ilk bakılacak yer Realtime'ın
  rol yetkisi ve kanalın oturumdan önce açılması.

### 🏁 PRESENCE TAMAMEN KALKTI — oda listesi de tabloda (2 Eylül)

Üç oturumluk yolculuğun sonu. Oda listesindeki kişi sayısı, presence'a kalan
son tüketiciydi; artık `oda_kisi_sayilari()` (070) ile gerçek katılımcı
tablosundan geliyor ve `oda_katilimcilar` üzerindeki `postgres_changes` ile
canlı tazeleniyor.

**`src/data/remote/odaVarlik.ts` SİLİNDİ** — genel presence kanalı artık
tüketicisiz. `room.tsx`teki `varlikBildir`/`varliktanCik` çağrıları da kalktı.

**Birleştirme kuralı da değişti.** Eskiden `max(presence, aktif_katilimci_sayisi)`
alınıyordu, çünkü iki kaynak da zayıftı ve "biri bile dolu diyorsa dolu" demek
gerekiyordu. Ama bu kural **hayalet odayı da listede tutuyordu**: uygulama zorla
kapanınca sayaç >0 kalıyordu. Artık kalp atışlı tek kaynak var; güvenilir
kaynağı zayıf olanla harmanlamanın anlamı yok. Eski sayaç yalnızca tablo
okunana kadarki ilk karede yedek.

> `odalar.aktif_katilimci_sayisi` kolonu DURUYOR ve `room.tsx` yazmaya devam
> ediyor — sıralama (060), "Odam" ve yönetim ekranları onu okuyor. Ama artık
> oda listesinin görünürlüğüne karar vermiyor.

### 👥 "ODADA KİM VAR" ARTIK SUNUCUDA — 070 (31 Ağustos) · ÇALIŞTIRILMASI GEREKİYOR

Presence'a kalan SON bağımlılık da kalktı. Koltuklar 068 ile tabloya taşındıktan
sonra geriye yalnız kişi listesi kalmıştı; ağ kopunca boşalıyor, sayı 0 düşüyordu.

**Tablo temel şemada zaten vardı:** `oda_katilimcilar(kullanici_id PK, oda_id,
session_id, giris_tarihi, last_heartbeat)` + `oda_stale_katilimcilari_temizle`.
Ama tablo BOŞTU, kimse yazmıyordu, `pg_cron` da kurulu değil — yani temizleyiciyi
çağıran yoktu. 070 bunu devreye alıyor:
`odaya_katil`, `oda_kalp_atisi`, `odadan_ayril`, `oda_katilimcilari_getir`,
`oda_kisi_sayilari`. Kalp atışı 25 sn, bayatlama eşiği 2 dk; temizleyici
katılım anında tetikleniyor (cron yok), okurken de bayat satırlar eleniyor.

İstemci: liste ve kişi sayısı bu tablodan; hayalet koltuk süzgeci de artık
presence yerine bu tabloya bakıyor. Küçültmede odadan AYRILMIYOR (koltukta
olduğu gibi). Presence yalnız kozmetiklerde (çerçeve/balon) kaldı.

### 🪑 DAVET/ONAYLA OTURTULUNCA "ZATEN MİKROFONDASIN" ÇIKMIYORDU (31 Ağustos)

Sıradan onaylanınca ya da davet kabul edilince koltuğa SUNUCU oturtuyor; yerel
`mySeat` hiç set edilmiyordu. Sonucu: sıra sayfasındaki buton hâlâ "El Kaldır"
diyor, basınca uyarı çıkıyor ama sayfa kapanmıyor; "Mikrofondan in" de
çalışmıyor. Kendi oturduğunda `mySeat` set edildiği için o yol düzgün
görünüyordu — kullanıcının fark ettiği ayrım buydu.

Koltuk uzlaştırması artık **çift yönlü**: sunucu beni oturttuysa yereli
dolduruyor, oturtmadıysa yereli bırakıyor. `oturuyorum` da tabloya bakıyor.

### 🪟 ANDROID'DE CAM YÜZEYLER AŞIRI SAYDAMDI (31 Ağustos)

`expo-blur`ın `BlurView`ı iOS'te gerçek bulanıklık uyguluyor, Android'de
pratikte hiçbir şey yapmıyor. Tasarım blur'un getirdiği koyuluğa güvendiği için
gradyanlar bilerek çok saydam (ProfileCard 0.30 → 0.42): iOS'te tam istenen his,
Android'de kart içi görünüyordu.

Yeni `src/components/CamZemin.tsx`: blur + gradyan + **Android'de telafi
perdesi** (`perde` prop'u, yüzey ne kadar saydamsa o kadar yüksek).
Uygulandığı yerler: `GlassPanel` (paylaşılan), `ProfileCard`, `RoomPanel`,
`MicQueueSheet`. Diğer blur kullanan dosyalar (GiftSheet, RoomStats,
BottomNav, RoomEntryGate, BadgeInfoModal…) henüz geçmedi.

> `experimentalBlurMethod="dimezisBlurView"` gerçek blur veriyor ama deneysel ve
> animasyonlu ekranlarda düşük seviye Android'de kare düşürüyor; kesin ve ucuz
> olan perde tercih edildi.

### 🩹 ÜÇ KARARSIZLIK DÜZELTMESİ (31 Ağustos)

**1. "Odayı ben kapatmadım, kendi kapandı."** Sebep bendim: eklediğim otomatik
düşme, kanal `CLOSED` olunca 15 sn sonra `router.back()` çağırıyordu. Ama
`CLOSED` normal bir geçiş — kendi temizliğimizde, yeniden bağlanmada, öne/arkaya
alınırken de oluyor (özellikle Android'de). Artık `CLOSED` odadan
DÜŞÜRMÜYOR; yalnız `CHANNEL_ERROR`/`TIMED_OUT` sayılıyor ve süre 45 sn.

**2. "Attım, benim ekranımda düştü ama kullanıcıda hâlâ mikrofonda."**
`canliKoltuklar` kendi koltuğumu sunucu yankısını beklemeden iyimser çiziyor
(dokununca anında dolsun diye) — ama bu iyimserliğin sonu yoktu. Yönetici
indirince sunucu koltuğu boşaltıyor, indirilen kişinin ekranı yerel `mySeat`
yüzünden kendini koltukta çizmeye devam ediyordu. **Sıradan onaylananlarda
`mySeat` hiç set edilmediği için o yol çalışıyordu** — kullanıcının fark
ettiği ayrım tam buydu. Artık: sunucu beni hiçbir koltukta görmüyorsa (ve
kendi isteğimin 3 sn'lik yankı penceresi geçtiyse) yerel koltuk bırakılıyor.

**3. "Odaya dönünce 'host ayrıldı' yazıyor, 3-5 sn sonra düzeliyor."**
Presence ilk turunu yapmadan `sahipOdada` false görünüyordu. Artık `Ayrıldı`
etiketi presence en az bir kez sync olana kadar hiç basılmıyor.

### 🎙️ MİKROFON AKIŞLARI — 069 (31 Ağustos) · ÇALIŞTIRILMASI GEREKİYOR

Üç akış: mikrofondan indirme, mikrofona davet, mikrofon sırası.

**Neyin bozuk olduğu:**
- **Mikrofondan indir** tamamen YERELDİ (`setSeats(...)`) — yöneticinin
  ekranında kişi kalkıyor, karşı tarafta hiçbir şey olmuyordu.
- **Mikrofon sırası** broadcast'teydi — sonradan giren yönetici bekleyenleri
  hiç görmüyor, bağlantı kopunca sıra siliniyor, "onaylandın" mesajı kaçarsa
  kimse oturmuyordu.
- **Mikrofon yasağı** (028) yalnız istemcide kontrol ediliyordu.

**069 ne getiriyor:**
- `oda_mic_sirasi` tablosu (realtime + RLS, yazma yalnız RPC ile)
- `_oda_moderatoru(oda)` — sahip / platform yöneticisi / `oda_uyeleri.rol`
  içinde sahip|yonetici|moderator
- `koltuktan_indir(oda, hedef)` — sahibin sahne koltuğu (20) korunuyor
- `mic_sirasina_gir`, `mic_sirasindan_cik(oda, hedef DEFAULT NULL)`,
  `mic_sirasi_onayla(oda, hedef)`, `mic_sirasi_getir(oda)`
- `koltuga_otur` yeniden tanımlandı: mikrofon yasağı artık SUNUCUDA da
  kontrol ediliyor, oturunca kişi sıradan düşüyor

**Onay artık sunucuda oturtuyor** — karşı tarafın istemcisine güvenilmiyor.
`mic_sirasi_onayla` ilk boş ve kilitsiz koltuğu bulup hedefi oraya yazıyor.

**Davet (`mic_davet`) bilerek broadcast kaldı:** kişiye özel, anlık, kalıcılığı
anlamsız bir bildirim. Kabul edilince zaten `koltuga_otur` çağrılıyor.

> **069'da yakalanan tuzak:** `koltuga_otur` içine `EXCEPTION WHEN
> undefined_table` koymuştum (sıra tablosu henüz yoksa diye). PL/pgSQL'de
> yakalanan hata **bloğun tamamını geri alır** — yani sıra silme patlarsa
> koltuğa oturma da iptal olurdu. Tablo fonksiyondan önce kurulacak şekilde
> sıra değiştirildi, yakalayıcı kaldırıldı.

> **KALAN:** "sustur" (başkasını susturma) hâlâ yerel — sunucu tarafı RPC yok.
> Ayrı iş.

> **072'de yakalanan 069 mantık hatası:** `_oda_moderatoru` sözlüğü
> `('sahip','yonetici','moderator')` idi ama `oda_uyeleri.rol` CHECK kısıtı
> yalnız `'sahip','yardimci','uye'` kabul ediyor — yardımcı için sorgu HER
> ZAMAN false dönüyordu; butonlar görünüyor, sunucu reddediyordu. KURAL:
> **`oda_yetkileri` tablosu ve `oda_rolu` enum'u ÖLÜDÜR, canlandırılmayacak.**
> Oda içi rol sözlüğünün tek kaynağı `oda_uyeleri.rol` CHECK kısıtıdır.

### ⌨️ ANDROID KLAVYE: sahne gizleniyor (31 Ağustos)

Belirti: "Android'de sohbete tıklayınca ekranın yarısı görünmüyor."

Sebep: `KeyboardAware` TÜM oda ekranını `behavior="padding"` ile sarıyor.
Klavye açılınca kullanılabilir yükseklik ~%40 azalıyor, ama üst bar ve sahne
(host koltuğu + mikrofon ızgarası) SABİT yükseklikte — koltuk çapı ekran
genişliğinden hesaplanıyor. Geriye kalan yer sohbete yetmiyor.

Çözüm: klavye açıkken sahne tamamen gizleniyor (`klavyeAcik` state,
`Keyboard` dinleyicileri). Yazarken sahneye zaten bakılmıyor; kapanınca
geri geliyor. Yalla ve WePlay de aynısını yapıyor.

### ⏱️ KOLTUK GECİKMESİ: fazladan tur kaldırıldı (31 Ağustos)

`postgres_changes` olayı `REPLICA IDENTITY FULL` sayesinde yeni satırı zaten
taşıyor. Eskiden olay gelince tabloyu yeniden OKUYORDUK, yani her değişimde
bir tur daha sunucuya gidiliyordu. Artık olay ANINDA uygulanıyor; tazeleme
(ad/foto join'i için) 120 ms sonra arkadan geliyor.

> **Bölge notu:** Supabase bölgesi (Frankfurt) proje kurulurken seçiliyor ve
> proje URL'sine gömülü — istemcide ayarlanacak bir şey YOK. Kalan gecikme
> ağ gidiş-dönüşü. `realtime.params.eventsPerSecond` ayarlanmıyor (varsayılan
> 10/sn); kullanımımız bunun çok altında, artırmak bir şey değiştirmez.

### 🧱 KOLTUK / MİKROFON / KİLİT ARTIK VERİTABANINDA — 068 (31 Ağustos, NİHAİ)

Üç oturumluk kovalamacanın sonu. Sıra şöyleydi: presence → (meta seçimi
düzeltildi) → broadcast → **veritabanı**. Kullanıcının son ölçümü:
*"aşırı kararsız, 1-2 defa yapınca anlık oluyor ama sonra yine buga giriyor,
bunları db'ye yazmak gerekiyor, presence'ı aradan çıkar."* Doğru karar.

**`068_oda_koltuklari.sql` — ÇALIŞTIRILMASI GEREKİYOR.**

> **ÖNCE ŞUNU OKU:** `oda_koltuklari` **temel şemada ZATEN VARDI.** İlk
> taslakta tabloyu yeniden kurmaya çalıştım; `CREATE TABLE IF NOT EXISTS`
> sessizce atlanacak ve RPC'ler olmayan sütuna yazıp `42703` ile
> patlayacaktı — 058'deki `hediyeler` hatasının birebir tekrarı. Kullanıcı
> "şemalarımızdan haberin var mı" diye sormasa canlıya gidiyordu.
> **§11'deki "migration yazmadan önce `db/SEMA_DOKUMU.md`'ye bak" kuralı
> tavsiye değil, şart.** Döküm sütun adlarını veriyor ama kısıtları vermiyor;
> kısıt/trigger için canlıdan `pg_constraint` + `pg_get_functiondef`
> sorgulanmalı.

**Canlı yapı (31 Ağustos'ta yoklandı):**
`oda_koltuklari(oda_id, koltuk_no, kullanici_id, kilitli, susturulmus,
guncellenme_tarihi)` · PK `(oda_id, koltuk_no)` · UNIQUE
`(oda_id, kullanici_id)` · CHECK `koltuk_no BETWEEN 1 AND 20`.
Trigger `trig_oda_koltuk_olustur` oda kurulunca `1..koltuk_sayisi` satırını
kendisi açıyor.

**İki tuzak:**
- **Koltuklar 1'den başlıyor, 0 ve negatif YASAK** — uygulama 0..7 ve sahip
  için -1 kullanıyor. Dönüşüm `roomsRepo`'da tek yerde:
  istemci `0..7 ↔ 1..8`, istemci `-1 ↔ 20` (`SAHIP_KOLTUK_NO`).
- **Sütun `susturulmus`, yani mantık TERS** (`mic_acik` değil).

068 tabloyu KURMUYOR; üstüne RPC (`koltuga_otur`, `koltuktan_kalk`,
`koltuk_mic`, `koltuk_kilit`, `oda_koltuklari_getir`), realtime yayını,
`REPLICA IDENTITY FULL` ve SELECT politikası ekliyor. Yazma yalnız RPC ile —
INSERT/UPDATE politikası bilerek tanımlanmadı.

> **KULLANILMAYAN ALTYAPI (sıradaki iş):** `oda_katilimcilar`
> (`kullanici_id` PK, `oda_id`, `session_id`, `last_heartbeat`) ve
> `oda_stale_katilimcilari_temizle(p_esik_dakika DEFAULT 5)` temel şemada
> **var ama tablo BOŞ**, kimse yazmıyor ve `pg_cron` **kurulu değil**, yani
> temizleyiciyi çağıran da yok. "Odada kim var" sorusunun doğru cevabı burası:
> istemci kalp atışı yazar, temizleyici düşenleri siler, oda listesi sayacı
> oradan okur. Bugünkü istemci-yazan `aktif_katilimci_sayisi` sayacını da
> presence'ı da tamamen aradan çıkarır.

**Neden bu yol:** kullanıcının ölçtüğü tek KARARLI taşıyıcı
`postgres_changes` — oda listesi 065'ten beri onunla anlık çalışıyor.
Presence hızlıydı ama kararsızdı; broadcast anlıktı ama yine kararsızdı
(iki uçtan biri kaçırınca telafisi yok, geriye dönük okuma yok). Tabloda ise
durum kalıcı: kaçırılan olay bir sonraki okumada zaten doğru geliyor.

**Presence tamamen kalkmadı** — "odada kim var" için kalıyor, zaten onun işi.
Koltuk çizilirken ikisi **kesiştiriliyor**: DB'de yazılı ama presence'ta
görünmeyen kişi (çökmüş istemci) koltukta gösterilmiyor. Hayalet koltuk
sorununu sunucuya kalp atışı eklemeden çözen kısım bu.

**Kozmetikler** (çerçeve, balon) presence'ta kaldı — geç gelirse yalnız
çerçeve geç çizilir, koltuk yanlış olmaz.

> **DERS — taşıyıcı seçimi:** olay mı, durum mu? Sohbet ve giriş efekti
> OLAYDIR → broadcast. Kim nerede oturuyor DURUMDUR → tablo + postgres_changes.
> Presence ikisi arasında kalıyor ve yalnızca "kim bağlı" sorusunda güvenilir.
> Bu ayrımı baştan yapmamak bu projede üç oturum yedi.

### ⚡ (ARA ADIM, AŞILDI) KOLTUK/MİKROFON/KİLİT BROADCAST'TE (31 Ağustos)

**Kullanıcının ölçümü yön verdi:** "sohbet anlık gidiyor, uygulamanın geri
kalanı da o hızda olmalı". Aynı soket üzerinde iki yol var ve hızları farklı:

| Yol | Hız | Ne için tasarlandı |
|---|---|---|
| `broadcast` (sohbet) | **anlık** | olaylar |
| `presence` (koltuk, mic, kilit) | saniyeler | durum anlık görüntüsü |

Presence'ı hızlandırmaya çalışmak yerine **değişimleri sohbetin gittiği yoldan**
gönderiyoruz. Presence kaldırılmadı — sonradan girenin "kim nerede oturuyor"
bilgisini oradan alması gerekiyor. Yani:

- **Değişim** (oturdum / kalktım / mikrofonu açtım / kilitledim) → `broadcast`,
  anında uygulanıyor (`koltuk` ve `kilit` olayları).
- **Anlık görüntü** (odaya yeni girenin gördüğü tablo) → presence, eskisi gibi.
- Çakışmasınlar diye: son 8 saniyedeki broadcast bilgisi presence'ı **ezer**.
  Yoksa presence turu eski değerle gelip koltuğu geri zıplatıyordu.

**Sohbetteki yetki rozeti** de düzeltildi: `isMe && privileged` idi, yani
herkes yalnız kendi rozetini görüyordu. Rozet BAKANIN değil YAZANIN yetkisini
gösterdiği için `yetki` artık mesaj yüküyle taşınıyor.

### 🔌 ARKAPLAN / KOPUK BAĞLANTIDA OTOMATİK DÜŞME (31 Ağustos)

Kullanıcı: *"expo'yu arkaya alıp ağ sorunu yaşanınca otomatik odadan düşsün,
yoksa buga giriyor. Odadan çıkıyorum ama mikrofona çık dediğim için öyle odada
kalıyor gibi."* — Doğru teşhis: arkaplanda soket kapanıyor ama presence kaydı
sunucuda bir süre asılı kalıyor, karşı taraf seni mikrofonda görmeye devam
ediyor.

- **Arkaplan:** `ARKAPLAN_MS` (20 sn) boyunca geri dönülmezse odadan düşülüyor.
  Hemen değil — kısa uygulama geçişleri cezalandırılmasın.
- **Kopuk kanal:** `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` sonrası `KOPUK_MS`
  (15 sn) içinde toparlanamazsa yine düşülüyor.
- Düşerken önce koltuk bırakılıp yayınlanıyor, sonra `untrack` — hayalet
  koltuk kalmıyor.

### 🟢 "AĞ SORUNU" SANILAN ÜÇ ŞEY AĞ SORUNU DEĞİLMİŞ (31 Ağustos)

Kullanıcı "ciddi ağ sorunları var" diye bildirdi; üçünün sebebi koddaydı.

**1. Koltuk avatarı hiç gelmiyordu.** `SeatItem` içinde:
```tsx
photo={isMe ? userPhoto || undefined : undefined}   // başkası için HER ZAMAN undefined
```
Kişinin fotoğrafı presence'tan geliyor ve `seat.photo`da duruyor ama Portrait'e
hiç verilmiyordu. Kartı açınca görünmesinin sebebi de buydu: veri var, koltuk
çizmiyor. **Aynı hata host koltuğunda daha önce bulunup düzeltilmiş, sıradan
koltuklarda gözden kaçmış** — düzeltirken "aynı desen başka nerede var" diye
bakılmamış.

**2. Çerçeve ve yetki rozeti "platforma göre" görünüyordu.** Gerçekte:
```tsx
cerceveTema={s?.name === "Sen" ? kusanili.cerceve : undefined}
{isMe && privileged && <AuthorityTag />}
```
İkisi de **yalnızca kendine** çiziliyordu. iPhone'da "sorunsuz görünen" şey
kullanıcının KENDİ çerçevesi ve KENDİ rozetiydi; Android hesabında kuşanılmış
çerçeve olmadığı için hiçbir şey çıkmıyordu. Platform farkı değil, hesap farkı.
Veri presence'ta zaten taşınıyordu, hiç kullanılmıyordu. Artık `Seat` tipinde
`cerceve` ve `yetki` var, presence yükü `yetki` de taşıyor, host koltuğu
dahil herkes için çiziliyor.

**3. Giriş efektini karşı taraf görmüyordu.** Giriş, presence anlık
görüntüleri karşılaştırılarak ÇIKARILMAYA çalışılıyordu ("önceki sync'te yok
muydu", "katildi damgası ilerledi mi"). Presence bir DURUM taşıyıcısıdır, OLAY
taşıyıcısı değil: iki sync tek diff'te birleşebiliyor, sıra garanti değil.
Artık giriş bir `giris` broadcast olayı — giren bir kez yayınlıyor, odadakiler
anında oynatıyor. Çıkarım yok, karşılaştırma yok.

> **DERS:** "iOS'te çalışıyor Android'de çalışmıyor" raporlarının ikisi de bu
> oturumda platform hatası çıkmadı (biri sessiz yutulan hata, biri kendine
> çizme). Platform farkı sanılan şeyden önce **hesap farkı ve render yolu**
> kontrol edilmeli.

**KALAN (hâlâ presence'ta, taşınacak):** mikrofona çıkışın karşıda birkaç
saniye gecikmesi, mikrofondan inişin hiç yayılmaması, koltuk kilitlerinin
geçmemesi. Bunlar kalıcı oda durumu; doğru yer `postgres_changes` (kullanıcının
ölçümüne göre ANLIK çalışan tek yol). Planlanan: `oda_koltuklari` tablosu +
RPC'ler, presence yalnız "odada kim var" sayısına düşer, koltuk yalnız hem
DB'de yazılı hem presence'ta görünen kişi için çizilir (hayalet koltuk olmaz).

### 🔑 PRESENCE'IN EN SİNSİ HATASI — "meta" seçimi (31 Ağustos)

Oda içi senkron sorunlarının çoğunun ALTINDAKİ tek sebep buydu; ayrı ayrı
kovaladığımız belirtilerin hepsi buraya çıkıyor.

**Presence'ta bir anahtar altında BİRDEN ÇOK kayıt (meta) bulunabilir.**
`track()` ile durumunu güncellediğinde eski kayıt bir süre yenisiyle birlikte
duruyor ve dizideki sıraları garanti değil. Kod ise şunu yapıyordu:

```ts
for (const p of arr) {
  if (!members.some((m) => m.uid === p.uid)) members.push({ ...p });  // İLK kayıt
}
```

Yani **eski kayıt önce geldiğinde güncelleme tamamen yok sayılıyordu.** Belirtiler:
- Koltuğa oturuyorsun, eski kayıtta `koltuk: null` olduğu için karşı taraf seni
  koltuksuz görüyor → "mikrofona çıkınca karşıda görünmüyor".
- Kilit bazen geçiyor, kaldırma hiç geçmiyor, çık-gir yapınca düzeliyor
  (yeniden girişte state sıfırdan kurulduğu için).

Kilit okuyucusunda tam tersi hata vardı: **bütün kayıtları sırayla uyguluyordu**,
yani sonuç dizinin sırasına kalıyordu. "Gecikme + kararsızlık" buydu.

**Çözüm:** presence yüküne artan bir `surum` sayacı kondu; okurken anahtar
başına **en yüksek sürümlü tek kayıt** seçiliyor (`guncelKayit`). "En güncel
hangisi" artık tahmin değil, ölçüm.

**İkinci düzeltme — presence anahtarı artık mount başına benzersiz**
(`uid-CIHAZ-katildi`). Eskiden uygulama oturumu boyunca sabitti: odadan çıkıp
hemen geri girdiğinde önceki oturumun "ayrıldım" bildirimi, yeni kayıt
kurulduktan SONRA ulaşıp taze kaydı siliyordu — karşı tarafta odadan düşmüş
görünüyordun. "Çık gir yapınca bozuluyor" belirtisinin kaynağı bu.

> **DERS:** presence, oda geneline ait durumu (koltuk kilitleri gibi) taşımak
> için ideal taşıyıcı değil; kişi başına efemer durum için tasarlanmış. Kilitler
> ısrarla sorun çıkarırsa doğru yer `odalar` tablosu + `postgres_changes`
> (kullanıcının ölçtüğü kadarıyla o yol ANLIK çalışıyor, oda listesi oradan
> besleniyor) — üstelik sahibi odadan çıkınca kilitler kaybolmaz.

### 🟢 ODA İÇİ: dört şikâyet, dört sebep (30 Ağustos, düzeltildi)

Kullanıcının sıraladığı dört madde ve kök sebepleri:

**1. Giriş efektleri hiç görünmüyordu (iki platformda da).**
Presence döngüsü kendi uid'ini atlıyor ve yanında *"kendi efektim mount'ta
zaten oynuyor"* diyen bir yorum vardı — ama **onu oynatan kod hiç
yazılmamıştı**. Yorum bir varsayımı anlatıyordu, gerçeği değil. Artık odaya
her girişte kendi efektin bir kez kuyruğa giriyor (`room.tsx`, mount effect).

**2. Sohbet balonu altın gradyandı.** `m.myOwn ? "gold" : …` kaldırıldı; düz
balon varsayılan oldu. Altın yalnız isimde kalıyor, kuşanılabilir balon
alanlar kendi temasını görmeye devam ediyor.

**3+4. Mikrofon/koltuk yayılmıyor, gecikme var, ve sohbet TEK YÖNLÜ
çalışıyordu** ("iPhone'dan yazdığım Android'de görünmüyor"). İki ayrı sebep:

- **Cihaz kimliği yoktu.** Presence anahtarı `String(myDbId)` idi ve "bu mesaj
  benim mi" kontrolü de `p.uid === myDbId` bakıyordu. **Aynı hesapla iki
  cihazdan girildiğinde** (test ederken tam olarak bu yapılıyor) ikisi de aynı
  uid'i taşıyor: presence anahtarı çakışıp iki cihaz tek slotu eziyor
  (mikrofon/koltuk görünmüyor), gelen mesaj da "kendi echo'm" sanılıp
  `return` ediliyor (sohbet tek yönlü görünüyor). Artık modül düzeyinde bir
  `CIHAZ` kimliği var; anahtar `uid-CIHAZ`, karşılaştırma `p.cihaz === CIHAZ`.
- **~~Kanal kurulumu yarışıyordu~~ — DENENDİ, GERİ ALINDI.** `removeChannel`
  asenkron olduğu için aynı topic'e "leave" ve "join"in yarıştığını düşünüp
  silmeyi `await` etmiştim. Ölçüldü: **daha kötü.** `removeChannel` yanıt
  gelmezse **varsayılan 10 saniye** bekliyor; o süre boyunca `chanRef.current`
  null kalıyor, `send()` mock dalına düşüyor ve **sohbet hiç gitmiyor**,
  presence de hiç yayılmıyordu. Kullanıcı bunu "her iki tarafta da yazdıklarım
  düşmüyor" diye bildirdi. Kapanış artık beklenmiyor (eski davranış).

Ayrıca `send()` ve `track()` sonuçları artık **loglanıyor** — ikisi de
sessizce başarısız olabiliyordu (`send` websocket yerine REST'e düşebiliyor).

**GECİKMENİN GERÇEK SEBEBİ (ikinci tur) — iki ayrı yer, ikisi de bulundu:**

- **Girişte:** oda kanalı, `myDbId` daha yüklenmeden açılıyordu. Kanal
  SUBSCRIBED oluyor ama `presenceYaz` "uid yok" deyip erken dönüyordu — yani
  odaya girmiş ama presence'a **yazılmamış** oluyordun. Karşı taraf seni ancak
  profil yüklenip effect yeniden koştuğunda görüyordu. Üstelik `myDbId`
  değişince kanal komple yıkılıp yeniden kuruluyordu. Artık effect
  `myDbId == null` iken hiç başlamıyor.
- **Çıkışta:** `ch.untrack()` **beklenmeden** `sb.removeChannel(ch)`
  çağrılıyordu. `untrack` asenkron: "ben çıktım" mesajı gitmeden soket
  kapanıyor ve karşı taraf seni ancak sunucu presence zaman aşımına uğrayınca
  (onlarca saniye) düşürüyordu. Artık `untrack` beklenip sonra kapatılıyor
  (`room.tsx` ve `odaVarlik.varliktanCik` — ikisinde de aynı hata vardı).

> Kullanıcının verdiği referans doğruydu: oda listesi anlık çünkü o
> `postgres_changes` üzerinden geliyor (065), presence yolundaki bu iki
> kusurdan etkilenmiyordu.

**KOLTUK KİLİDİ yayılmıyordu.** `seatLocks` tamamen **yerel** state'ti,
hiçbir yere gönderilmiyordu: "kilitle" dediğin cihazda kilitli görünüyor,
diğerinde görünmüyordu. Artık oda sahibinin presence yükünde (`kilitler`)
taşınıyor; presence sonradan girene de aktarıldığından geç katılan da doğru
görüyor.

> **İLK DENEMEDE YANLIŞ YETKİLİ SEÇİLDİ (düzeltildi).** Şartı
> `MY_ROLE === "host"` yapmıştım — ama `MY_ROLE = privileged ? "host" : …`,
> yani developer/super_admin hesapların HEPSİ "host" sayılıyor. İki yönetici
> aynı odadayken ikisi de kilit yayınlıyor, biri diğerinin eski (kilitsiz)
> yükünü okuyup kendi kilidini geri alıyordu: "kilitledim, sonra baktım
> açılmış". Yayıncı artık **yalnız oda sahibi** (`isMine`) — tek yetkili.
> Bilinen sınır: sahip odada değilken yöneticinin koyduğu kilit yerel kalır.

> Hâlâ gecikme kalırsa bakılacak son yer `createClient`in
> `realtime.params.eventsPerSecond` varsayılanı — şu an hiç ayarlanmıyor.

### 🟢 HAYALET ODA — "iOS'te kurduğum oda listede yok" (BULUNDU, DÜZELTİLDİ)

**Belirti (kullanıcı, 30 Ağustos):** "Android'den oluşturduğum oda listeye
düşüyor, hem kendisinde hem iOS'te görünüyor. iOS'te listeye düşmüyor."

**Kök sebep — yutulan hata + sahte oda.** `appStore.createMyRoom` şöyleydi:

```ts
try { ...getMyRoom() ?? createRoom(...) }
catch { /* sessizce yerel odaya düş */ }
const r = makeMyRoom();   // <-- dbId YOK
```

Herhangi bir hata (oturum token'ı henüz hazır değil, ağ, RLS) yutuluyor ve
`makeMyRoom()` ile **`dbId`si olmayan sahte bir oda** veriliyordu. O oda
ekranda tıpatıp gerçeği gibi görünüyor, adı/ID'si çıkıyor, İÇİNE GİRİLEBİLİYOR
— ama veritabanında YOK. Sonucu: hiçbir listeye düşmüyor, kimse göremiyor,
`isDbRoom` false olduğu için ne presence yayınlanıyor ne katılımcı sayacı
yazılıyor. Kullanıcıya tek uyarı bile çıkmıyordu.

**Cihaza bağlı değil** — Android'de de olabilirdi; iOS'teki çağrı bir kez hata
aldı ve kullanıcı farkında olmadan sahte odayla kaldı. Tesadüfen iOS'e denk
geldiği için "iOS hatası" gibi göründü.

**Düzeltme:**
- `createMyRoom` oturum varken **artık sessizce yerel odaya düşmüyor**, hata
  yukarı gidiyor. Yerel odaya düşmek yalnız Supabase/oturum yokken (mock akış).
- `my-room.tsx` hatayı yakalayıp **ekranda gösteriyor** ("Oda kurulamadı: …").
- `odamGercek` kontrolü: `dbId`si olmayan oda "odam" sayılmıyor. Elinde eski
  bir hayalet oda kalmış kullanıcı butonu "Gir" değil **"Oluştur"** görüyor ve
  gerçeği kuruluyor.

> **DERS (bu oturumda üçüncü kez):** bu projedeki en pahalı hatalar sessizce
> yutulan hatalar. Presence (`.catch(() => {})`), oda sayacı (057'nin sessiz
> `RETURN`u) ve şimdi de sahte oda — üçü de "hata yok, ama iş de olmuyor"
> davranışıyla saatler yedi. Yeni kod yazarken: **yutulan hata = teşhis
> edilemeyen hata.**

### 🔴 YÖNETİCİ BAKİYESİ CÜZDANA GELMİYOR — sebebi bulundu, 067 yazıldı

**Belirti (kullanıcı, 30 Ağustos):** yönetim panelinden bakiye veriliyor,
**panelde sayı artıyor**, kullanıcının cüzdanında hiçbir şey değişmiyor.

**Kök sebep — 062 yarım kaldı.** 062 altını temel deftere taşırken OKUMA ve
HARCAMA yollarını taşıdı, **yönetici YAZMA** ve **panelin OKUMA** yollarını
taşımadı. Üç yol üç ayrı yere bakıyordu:

| Yol | Nereye bakıyor |
|---|---|
| `bakiye_ekle` → `_bakiye_uygula` | `public.cuzdan` — **ölü tablo** (027) |
| `admin_kullanici_getir` | `LEFT JOIN public.cuzdan` — **ölü tablo** (038) |
| `benim_bakiyem()` (kullanıcının cüzdanı) | `kullanicilar.cached_*` — gerçek (062) |

Yönetici yazıyor ve panel **aynı ölü tablodan** okuduğu için işlem başarılı
görünüyor; kullanıcının cüzdanı ise temel defteri okuduğundan haberi olmuyor.
Yani hata "bakiye kaydolmuyor" değil, **"iki ekran iki ayrı tabloya bakıyor"**.

**Çözüm — `067_admin_bakiye_temel_deftere.sql` (YAZILDI, ÇALIŞTIRILMADI):**
`bakiye_ekle` artık `lot_yatir`/`lot_harca` ile temel deftere yazıyor
(063'ün `admin_altin_yukle` deseni), `admin_kullanici_getir` de
`cached_total_balance`/`cached_altin_balance` okuyor. İmzalar aynı — istemcide
tek satır değişmiyor. Dondurma bayrakları bakiye değil, `cuzdan`da kalıyor.
Dosyanın sonunda **isteğe bağlı** ve kendini bir kez çalıştıran (iki kez
çalıştırınca şişirmeyen) eski bakiye devir bloğu var — yorumlu, karar senin.

> **Aynı kırık yolda kalan:** `bakiye_transfer` (027) hâlâ `cuzdan`da dönüyor.
> Şu an hiçbir ekran çağırmıyor (`walletRepo.transfer` dışa açık ama
> kullanılmıyor), bu yüzden bilinçli olarak 067'ye alınmadı.

> **Açık soru:** varlık dondurma (034) bayrakları `cuzdan`da; temel defterin
> `lot_harca`'sı bu bayraklara bakıyor mu bilinmiyor. Dondurma artık
> harcamayı engellemiyor olabilir — ayrıca doğrulanmalı.

### ⚠️ Çalıştırılmayı bekleyen migration'lar

Canlı veritabanı **2 Eylül'de** yoklandı (`pg_proc` sorgusuyla).

| Dosya | Durum |
|---|---|
| `072`-`079` (Faz 0 mantık+kararlılık seti) | ❌ **ÇALIŞTIRILACAK** — sırayla 072→079, hepsi idempotent. İstemci hazır: 078 çalışana kadar sohbet DB yazımı sessizce düşer (broadcast etkilenmez), 079 çalışana kadar sayaç sadece yazılmamış olur |
| `053_admin_oda_kapak.sql` | ❌ eksik → yönetim panelindeki kapak düğmeleri hata verir |
| `067` · `068` · `069` · `070` · `071` | ✅ uygulandı, fonksiyonlar canlıda doğrulandı |
| 001-066 | ✅ uygulandı |

**Faz 0 seti ne düzeltiyor (özet):** 072 yardımcının sunucuda reddedilmesi
(yanlış rol sözlüğü) · 073 koltuk/onay yarışları (sessiz ezme → 'Koltuk dolu.')
· 074 çift dokunuşta çift ücret/ödül · 075 e-posta yalnız developer'a ·
076 eksik pg_temp · 077 anon süpürmesi (021-024) · 078 oda mesajı RPC +
kalıcılık (mic yasağı sunucuda) · 079 sayaç emekliliği (tek kaynak
`oda_katilimcilar`). İstemci tarafı aynı commit'lerde bağlandı; kendi giriş
efektinin çift oynaması da düzeltildi (yinelenen mount bloğu).

Doğrulama sorgusu (tekrar gerekirse):

```sql
SELECT jsonb_pretty(jsonb_object_agg(p.proname, TRUE))
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
 WHERE ns.nspname = 'public'
   AND p.proname IN ('koltuga_otur','koltuktan_indir','mic_sirasina_gir',
                     'mic_sirasi_onayla','odaya_katil','oda_kalp_atisi',
                     'oda_katilimcilari_getir','oda_kisi_sayilari',
                     'admin_oda_kapak_ayarla');
```
065 Realtime aboneliğiyle doğrulandı ("Subscribed to PostgreSQL").
063+064 sonrası anon erişimi ölçüldü: hediye/sıralama/görev/cüzdan RPC'lerinin
hepsi ve `hediyeler`/`esyalar`/`gorevler` tabloları **kapalı** (42501).

> **YETKİ KURALI — pahalıya patlayan ders:** PostgreSQL yeni fonksiyona
> **PUBLIC**'e EXECUTE verir ve `anon` PUBLIC'in içindedir. Yani
> `REVOKE ... FROM anon` tek başına KAPATMAZ — rolün kendi grant'ını siler,
> PUBLIC'ten geleni değil. Her yeni fonksiyonda önce
> `REVOKE ALL ... FROM PUBLIC`, sonra hedef role `GRANT`.
> 064 tam olarak bu yüzden gerekti (`_enum_etiket`, `_enum_liste`,
> `_siralama_baslangic`, `_bugun_tr` açık kalmıştı).
>
> **AYNI KURALIN TERSİ (068'de yakalandı):** `REVOKE ... FROM PUBLIC` de
> role'e **doğrudan** verilmiş yetkiyi kaldırmaz. `oda_koltuklari`'nda
> `authenticated` INSERT/UPDATE/DELETE'i doğrudan almıştı; PUBLIC'ten
> revoke etmek işe yaramadı, ayrıca `REVOKE ... FROM authenticated` gerekti.
> Yani her iki yönü de kontrol et: PUBLIC'ten geleni VE rolün kendi grant'ını.
> Doğrulama sorgusu: `information_schema.role_table_grants`.

> **Kritik kural:** Client kodunu uygulanmamış migration'a bağlama. Daha önce
> `kusanilan_rozet` DB'de yokken SELECT'e eklendi ve **tüm profil okumaları**
> `42703` ile çöktü. Bu yüzden `roomsRepo.odalariGetir` artık kendini koruyor:
> yeni kolonlar yoksa temel kolonlara düşüp çalışmaya devam ediyor.

### 28 Ağustos — ilk yarı (gece 03:00–05:00)

**Referans:** WePlay (oda sahnesi) ve Yalla (üst bar) ekran görüntüleri.

**Oda ekranı**
- Mikrofon sırası ayrı sayfaya alındı (`sheets/MicQueueSheet.tsx`); FAB ikonu
  mikrofon → **el kaldırma** (`hand`), bekleyen sayısı rozetiyle.
- Koltuk ölçüleri WePlay'den ölçülüp **orana** çevrildi: çap = sütunun %51'i,
  sahip = koltuğun 1.5 katı (WePlay 1.65 ama bizde isim+etiket var). Izgaranın
  14pt yatay dolgusu kaldırıldı — sıkışıklığın asıl sebebi buydu.
- **Oda sahibi başka koltuğa oturamaz** (üç yol da kapatıldı).
- Üst bardaki geri oku kaldırıldı (güç düğmesi zaten "Küçült" sunuyor).
- Oda çipi Yalla'ya göre: sol kenara yapışık, solu köşeli/sağı oval, yumuşak
  saydam; içine **kazanılmış oda rozetleri** eklendi.
- **Tema odaya hiç uygulanmıyordu** — zemin sabit gri gradyandı, `Scene`
  yalnızca 36px'lik çipte kullanılıyordu. Zemin artık `<Scene>` + perde.
- Mikrofon-kapalı rozeti avatarın ortasının altındaydı → sağ alt köşe.

**Oda profili paneli** — tek akan sayfa oldu (kutu-içinde-kutu bitti). Sabit
`ROOM_LV=29 / 13.490 XP / "Dil: Türkçe"` verileri silindi. Oda sahibi satırı
eklendi. Oda fotoğrafı her yerde 1:1 avatar gibi ele alınıyor.

**Profil kartı** — herkese aynı sabit rozetleri gösteriyordu
(`CARD_BADGES` = developer+VIP+ajans). Gerçek profil çekiliyor; seviye artık
profildeki gibi rütbe rozeti (avatardaki "LV" çipi kaldırıldı).

**Sahte veri temizliği:** "959 oda", LV.28/ID 1149663822 varsayılanları,
"cinsiyeti boş olana Erkek / ülkesi boş olana Türkiye", cüzdanda "12.4K/860",
yayıncı "$142.50/$92.40", DM rozetinde sabit "3", akışta koşulsuz nokta,
`live: true` sabiti, "Arkadaşlar" satırı — hepsi gerçek veriye bağlandı ya da
kaldırıldı. **Hâlâ sahte:** `data/tasks.ts` (görev sistemi yok), oda rozetleri
(`Room.badges` yalnız mock), "Normal Hediyeler: 4.926" (flag kapalı).

**Oda listesi**
- **Sekmeler hiçbir şey yapmıyordu** (dördü aynı listeydi) → gerçekten
  filtreliyor. Yeni set: **Keşfet · Popüler · Yeni · Resmî**.
- Sıralama: resmî → Daily Top (1,2,…) → normal.
- Görünürlük (istisnasız): **gizli/kilitli, yasaklandığım, işlem görmüş, boş**
  odalar listelenmez.
- Sekme çubuğu banner'ın altına alındı; banner çerçevesi artık **fotoğrafın
  kendi oranını** alıyor (sabit orana sığdırma denemeleri hep kırpıyordu).

**Tema birliği (siyah-altın):** cüzdan (mordu), profil (mor-kahve kapak),
görevler (mor), özel ID (kahve), 9 admin ekranı (kahve) → hepsi temaya çekildi.
Emoji temizliği: 🏦🧾🎖️⚠️🔒✓💎❧☙◆◇↻ → ikon setine.

**Sekme bileşeni** (`components/Tabs.tsx`): çizgi artık **kayıyor**, yeni
`fill` modu. Cüzdan/görevler/özel ID/yönetimdeki "segment buton" geçişleri
bununla değiştirildi. Alt sekme çubuğunda da gösterge kayıyor + ikon büyüyor.

**Özel ID / taht kartı:** taç ve kanatlar emojiydi ve negatif konumlarla
üst üste biniyordu → taç ikon madalyonu olarak kendi boşluğunda.

**Kopyalama:** dört kopyalama ikonu vardı, **hiçbiri panoya yazmıyordu**.
`expo-clipboard` kuruldu, ortak `components/KopyaBtn.tsx`.

**Yönetim (admin)**
- Kullanıcı yönetimi baştan tasarlandı: dört bölüm ayrı sayfaydı → **sekmeli**.
  Tek `chip` stili hem seçim hem aksiyon için kullanılıyordu → `Secim` /
  `Aksiyon` / `Anahtar` diye üçe ayrıldı. Ceza süreleri sabit 3 sütunlu ızgara.
- **Onay pencereleri**: hesap yasağı, mikrofon yasağı, şifre sıfırlama —
  üçü de tek dokunuşla çalışıyordu.
- Ara kullanıcı özet ekranı silindi (`admin-user.tsx`); doğrudan sekmeli ekran.
- Oda rapor detayı: rapor belirgin kart, tam genişlikte **Odaya Uyarı** +
  **İncelendi** (rapordan çıkmadan uyarı gönderme yoktu).
- Yönetici oda düzenlemesi **store'a yansımıyordu** → `patchRoomByDbId`.
  Oda kapağı yalnızca gösteriliyordu → `053` + kontroller.

**"Bu odaya işlem yapıldı" (054)** — yönetici işlemi yalnız loga yazılıyordu;
sahip işlem görmüş odayı serbestçe düzenleyebiliyor, giren uyarı görmüyordu.
Artık: DB'de kalıcı işaret, **RLS ile sahibin UPDATE'i engelleniyor**, oda
yönetiminde kilit + kırmızı uyarı, listede filtre, **girişte uyarı**.

**Odaya giriş perdesi** (`components/RoomEntryGate.tsx`): "Odaya giriliyor…"
+ işlem görmüş odada uyarı ("hemen ayrılmazsanız hesabınız da cezai işlem
görebilir") + Ayrıl / Riski kabul et.

### Yeni dosyalar (bu oturum)

```
src/sheets/MicQueueSheet.tsx      src/components/KopyaBtn.tsx
src/components/RoomEntryGate.tsx  db/migrations/052,053,054
```
**Silinen:** `src/app/admin-user.tsx` · **Yeni paket:** `expo-clipboard ~8.0.8`
**Yeni ikonlar:** `hand`, `bank`, `wallet`

### 28 Ağustos — ikinci yarı (10:55–12:35)

**Gizlenen her şey açıldı** (`6a46b3b`) — 13 bayrak `false` → `true`;
`features.ts` başına "açık ama hâlâ sahte" uyarısı yazıldı (bkz. §7).

**Metro / tünel teşhisi** — sol alttaki **"Downloading..." donması**: makinenin
bir bulut sunucusu olduğu anlaşıldı, LAN QR'ı hiçbir zaman çalışmayacaktı.
cloudflared kalıcı olarak `.tools\` altına indirildi, Metro tünel adresiyle
yeniden başlatıldı, manifest tünel üzerinden **200** döndü. Ayrıntı: §8.

**Sıralama ekranı** (`4033071`) — Zenginlik / Cazibe / Odalar sekmelerinin
**üçü de aynı listeyi** gösteriyordu (hepsi aynı `else` dalına düşüyordu).
Üçü ayrıldı; podyum yeniden yapıldı, ekran siyah-altın temaya çekildi.

**Ajanslar / yayıncılar** (`e54f9a0`) — ajanslara güce göre kademeli arma,
ilk üçe kendine özgü amblem; yayıncı listesinde ilk üç vurgulanıyor.

**DM · arkadaşlar · etkinlik · bildirimler** (`4858338`, `d14decc`) — DM
avatar hizası düzeltildi; arkadaş listesi/istekleri ve ziyaretçiler ekranı
elden geçirildi (satırın tamamı basılabilir, ikonlu boş durumlar).

**Aron VIP** (`81b1298`) — mor kademe kimliği siyah-altına çekildi (Asil =
bronz, Hükümdar = altın); dağınık öğeler tek "kademe kartı"nda toplandı.

**Hesap & Güvenlik · hediye geçmişi · kupon** (`a411096`) — oturumun son işi.
Sahte olduğu hâlde gerçekmiş gibi davranan üç akış düzeltildi:
- **Şifre güncelleme hiçbir şey yapmıyordu** (yalnızca "Şifre güncellendi"
  ekranı açılıyordu) → `authRepo.changeMyPassword`: önce mevcut şifreyle
  doğrulama, sonra `auth.updateUser`.
- Sabit telefon numarası kullanıcının numarasıymış gibi yazıyordu → oturumun
  gerçek e-postası; sahte 4 haneli telefon doğrulama akışı kaldırıldı.
- Bağlı hesaplar yerel state'ti (açılışta Apple bağlı görünüyordu) → gerçek
  `user.identities`.
- Kupon: "ARON" ile başlayan **her** kod "500 altın + 7 gün VIP tanımlandı"
  diyordu → artık ödül verdiğini iddia etmiyor.

> **Kullanıcının sorusu "hepsini backend'e bağlıyorsun değil mi?" — cevap:**
> Hayır. Bu oturumdaki işler **görsel**. Zaten bağlı olanlar (ziyaretçiler,
> bildirimler, oda listesi, cüzdan bakiyesi, profil, yönetim işlemleri)
> korundu, bazılarında sahte veri gerçeğine çevrildi; hediye / mağaza / VIP /
> envanter / ajans / görev **hâlâ tamamen sahte**. Yeniden tasarlamak onları
> çalışır yapmıyor.

**Oturum çöktü** — kupon dosyası yazıldıktan hemen sonra "Prompt is too long";
o yüzden bu bölüm oturumun kendisinde yazılamadı. `tsc` yeni oturumda
çalıştırıldı (**exit 0**), dört dosya `a411096` ile commit'lendi.

### 29-30 Ağustos oturumu — ekonomi gerçeğe bağlandı

> **En önemli bulgu:** temel şemada (repoda dosyası olmayan, doğrudan
> Supabase'de kurulu olan kısım) **zaten eksiksiz bir ekonomi varmış** ve biz
> aylardır onun yanına ikinci bir tane kuruyorduk. Bkz. `db/SEMA_DOKUMU.md`.

#### Giriş / kayıt / profil

- **Doğrulama modülü** (`src/lib/authValidation.ts`) — üç kural seti tek yerde:
  - `sifreGucu`: uzunluk (8/12/16) + karakter sınıfı puanı; ceza olarak
    e-posta adını içerme, karakter tekrarı, ardışık dizi (abcd/1234/qwerty),
    yaygın şifre listesi (doğrudan 0). Kayıt için skor ≥ 2 **ve** ≥ 8 karakter.
  - `epostaKontrol`: rol/sistem adları (admin, test, root, destek, noreply,
    aron…), admin/test ile başlayan-biten, rakamla başlayan, tamamı rakam,
    5+ ardışık rakam, 4+ rakamla biten, rakam oranı %40 üstü, sesli harfsiz
    7+ karakter, 4+ aynı karakter, 20 tek kullanımlık alan adı.
  - `kullaniciAdiKontrol`: 3-20, harfle başlar, harf/rakam/nokta/alt çizgi,
    ayraçlar üst üste gelemez, ayraçla bitemez, ayrılmış adlar.
  - **Kural:** eleme YALNIZCA kayıtta çalışır. Girişte sadece biçim kontrolü —
    kurallar sonradan geldiği için önce açılmış hesaplar kilitlenmesin diye.
- Kayıt artık girişin kopyası değil: "ADIM 1/2" rozeti, şifre tekrarı, güç
  göstergesi. Alanlar ortak `components/Alan.tsx`'te (etiket, odakta altın
  çerçeve, göz ikonu, sol/sağ rozet) — profil düzenleme de bunu kullanıyor.
- Profil oluşturma: avatar 116px altın halka + yazdıkça ad önizlemesi, hazır
  avatarlar yatay şerit. **Kadın seçeneği erkek ikonuyla çiziliyordu** →
  ikon setine `female` eklendi.
- `EditProfileSheet`: tek kural "2-24 karakter"di (`admin`, `..` geçiyordu) →
  kayıtla aynı kurallar. Ayrıca yerel ad DB'ye yazılmadan ÖNCE güncelleniyordu;
  ad alınmışsa ekran yalan söylüyordu → önce DB, sonra ekran.
- `AronMark` yeniden çizildi (mor dolgu + BlurView gitti, tek SVG).

#### Odam ekranı (055)

- Üç sekme de aynı sahte listenin dilimleriydi. Artık üç ayrı gerçek kaynak:
  **Son günlerde** → `oda_ziyaretleri` (yeni), **Katıl** → `oda_uyeleri`,
  **Takip et** → `oda_takip` (yeni).
- RoomPanel'deki "Takip Et" yalnızca yerel state'ti; artık DB'ye yazıyor.
- Ekran temaya çekildi (mor kart → siyah-altın), ortak `Tabs`, boş durumlar,
  aşağı çekip yenileme, "3 sa önce" etiketi.

#### Oda katılımcı sayacı (057)

`odalar.aktif_katilimci_sayisi` her yerde OKUNUYOR ama hiçbir yerde
YAZILMIYORDU. Oda listesi "boş odaları gösterme" kuralını buna göre
uyguladığı için **yeni kurulan hiçbir oda hiçbir sekmede görünmüyordu**.
Artık odadaki istemcilerden biri (en küçük uid) presence'taki gerçek sayıyı
`oda_katilimci_yaz` ile yazıyor. Sunucu tarafı presence doğrulaması yok →
sayı advisory.

#### Giriş perdesi yeniden kurgulandı

Perde oda ekranının İÇİNDEYDİ: önce odaya giriliyor, sonra kontrol ediliyordu
— yasaklı olduğun odaya bile girip sonra atılıyordun. Artık perde
`AppOverlays`'te, **odaya girmeden önce** bulunduğun ekranın üstünde açılıyor
ve kontroller orada yapılıyor: oda yasağı, işlem görmüş oda (sahibine ayrı
metin), bağlantı hatası + "Tekrar dene". Bütün giriş noktaları
`odayaGirDene()` üzerinden geçiyor.

#### Eşya sistemi (056) — çerçeve / giriş efekti / sohbet balonu

- `esyalar` + `kullanici_esyalari` + `esya_satin_al` / `esya_kusan` /
  `esya_cikar` + `kusanili_esyalar` görünümü. 42 eşya (20 çerçeve,
  12 giriş efekti, 10 balon), asset yok — hepsi kodla çiziliyor
  (`FramePreview` halka tarifleri + `data/esyaTemalari.ts`).
- Kuşanılanlar presence yüküyle taşınıyor: odadaki herkes birbirinin
  çerçevesini/balonunu/giriş efektini ek sorgu olmadan görüyor.
- Çerçeve yalnızca **mikrofon koltuğunda ve kullanıcı kartında** görünür
  (sohbette kalabalık yapıyordu). Balon her mesajda, giriş efekti
  mikrofonların altındaki hapta.
- ⚠️ Bu yapı temel şemadaki `magaza_esyalari` + `kullanici_envanteri` ile
  ÇAKIŞIYOR — taşıma sırası: hediye (bitti) → mağaza/envanter → cüzdan.

#### Hediye ekonomisi — 058 yazıldı, sonra 059 ile temel şemaya taşındı

`058` kendi tablolarımızı kurmuştu. Ardından temel şemada `hediyeler` +
`hediye_gecmisi` ve iki trigger olduğu ortaya çıktı:

- **BEFORE `hediye_gonder_fn`**: `gifts_enabled` bayrağı, fiyat katalogdan,
  komisyon `ayarlar.hediye_komisyon_orani`'ndan (varsayılan 0.40),
  `idem_kaydet`, kullanıcı kilidi, `gift_ban`/`economy_frozen`/`banli`,
  `limit_tuket('daily_gift')`, **`lot_harca('altin')`**, gönderene XP.
- **AFTER `hediye_after_fn`**: `kazanc_hareket` ile alıcıya kazanç, XP+seviye,
  `sistem_hesap_hareket('platform_havuz')`, oda XP'si + `room_stat_deltalari`,
  `outbox_events`.

Eksik olan tek şey **istemci erişimiydi**: RLS açık ama politika yok, sarmalayıcı
yok. `059` o kapıyı açıyor: komisyon **%30**, `gifts_enabled` açık, kataloğa
`kod/emoji/renk1/renk2/kademe` kolonları + 29 hediye, okuma politikaları,
`hediye_gonder_v2`, `benim_bakiyem_v2`, `kazanc_*_v2`, `son_hediyelerim_v2`,
`admin_altin_yukle`, `hediye_komisyon`.

**Para birimi:** hediye **ALTIN** ile gönderilir (elmas satın alınıp altına
çevrilir), kazanç `kullanicilar.kazanc_puani`nda birikir. `058`'in tabloları
artık kullanılmıyor (silinmedi, istemci koptu).

#### Yayıncı paneli + para çekme

- Panel gizliydi: `isStreamer` DB'den hiç gelmiyor (kolon yok), sabit false.
  Giriş herkese açıldı.
- Ekran baştan sona yeşildi → siyah-altın. Kazanç kartı, **saatlik kazanç
  grafiği** (Bugün/Dün, "en iyi saat"), son 7 gün, son gelen hediyeler —
  hepsi `hediye_gecmisi`'nden gerçek veri.
- Para çekme tek uzun formdu, %16 kesintiyi ancak kendi ID'ni yazınca
  öğreniyordun → üç adım: **Tutar → Alıcı → Onay**, kesinti alıcı seçilirken
  yazıyor, başarı ekranı tam ekran. (Rakamlar hâlâ örnek veri; gerçek çekim
  `withdrawal_requests` + `cekim_talep_olustur`'a bağlanacak.)

#### Hediye görselleri

- Yayın şeridi 16 sn kayıyordu → sağdan girip **yerinde duran** kapsül,
  üst barın altında.
- `GiftFx`: dev emoji + emoji kopyaları → gradyan madalyon, halkalar, renkli
  kıvılcımlar, kademe çipli bilgi kapsülü.
- `BigGiftOverlay`: emblem madalyona alındı, alt açıklama yeniden düzenlendi.
- Hediye artık **sohbete de düşüyor** (kim → kime, ne, kaç tane), kompakt
  kapsül olarak.
- Hediye kutusu: mor → siyah-altın, gerçek bakiye + "＋" ile cüzdan, açılır
  adet seçici, toplam tutar, sahte "LV.1 · 5000 EXP" çubuğu silindi.

#### Oda içi senkronizasyon (devam ediyor)

- Koltuklar **tamamen yerel state'ti** — kimse kimsenin mikrofona çıktığını
  görmüyordu. Koltuk + mikrofon durumu presence yüküne alındı (`koltuk`,
  `mic`), gerçek odada ızgara presence'tan çiziliyor.
- Sahip koltuğu mock `SEATS`ten geliyordu → her odada "Ardaowski" sahipti.
  Artık sahip DB'den (`odaSahibi`): odadaysa canlı fotoğrafı, değilse soluk
  + "Ayrıldı" çipi.
- `Room.ownerId` eklendi; sahip eşleşmesi isimle değil uid ile yapılıyor.
  `isMine` de ownerId'ye bakıyor (oda listesi profil yüklenmeden çekilirse
  sahip kendi odasında ziyaretçi sanılıyordu).
- **Çözülen son hata:** host koltuğundaki `Portrait`'e ziyaretçi için
  `photo={undefined}` geçiliyordu — sahibin fotoğrafı hesaplanıyor ama
  ekrana hiç verilmiyordu.
- ⚠️ **AÇIK:** "koltuğa oturdum, karşı tarafta bir süre görünüp kayboluyor".
  `room.tsx`'te geçici `console.log("[presence] …")` teşhis satırları var,
  Metro loglarından izlenecek. **İş bitince o satırlar kaldırılacak.**

#### Veritabanı dökümü — `db/SEMA_DOKUMU.md`

Anon anahtarla şema okunamıyor (her tabloda `REVOKE ALL FROM anon` + RLS).
Geçici `SECURITY DEFINER` döküm fonksiyonlarıyla çıkarıldı, sonra silindi:
**104 tablo · 838 sütun · 131 fonksiyon**. Güvenlik durumu temiz: RLS
103 tablonun hepsinde açık, ekonomi tablolarının hiç politikası yok
(yani herkese kapalı), anon'a verilmiş yazma yetkileri politikasız olduğu
için işlemiyor.

**Temel şemada hazır ama BAĞLANMAMIŞ olanlar:** `cuzdanlar` + `wallet_ledger`
(partisyonlu) + `balance_lots`, `magaza_esyalari` + `kullanici_envanteri`,
`ajanslar` + `ajans_uyeleri` + `yayinci_odemeleri`, `withdrawal_requests`,
`kur_oranlari`, `elmas_paketleri`, `satin_almalar`, `kullanici_vip`,
`leaderboards`, `room_statistics`, `kyc_requests`, `risk_events`,
`user_limits`, `idempotency_keys`, `outbox_events`.

### 30 Ağustos — sıralama, görevler ve tek altın bakiyesi

#### Sıralama gerçeğe bağlandı (060)

Beş sekmenin beşi de `data/seed.ts` sabitleriydi (uydurma isimler, uydurma
puanlar). Artık:

- **Zenginlik** = dönem içinde en çok hediye GÖNDEREN (`toplam_deger`).
- **Cazibe** = en çok hediye ALAN (`kazanc_miktari` — yayıncı panelindeki
  kazançla aynı sayı olsun diye komisyon düşülmüş hâli).
- **Odalar** = odada dönen hediye değeri; henüz hiç hediye dönmediyse eskisi
  gibi en kalabalık odalar, üstünde bunu söyleyen bir etiketle.
- **Ajanslar / Yayıncılar** = dürüst boş durum. Uydurma şampiyon listesi
  (`AGENCY_RANKS`, `STREAMER_RANKS`) silindi; o tablolar temel şemada duruyor
  ama tek bir ajans/yayıncı kaydı bile yok.
- **Dönem seçici** eklendi (Bugün / Hafta / Ay / Tüm zaman). Başlıktaki
  "Haftalık · 2g 14s kaldı" sabit yazıydı; sayaç artık sunucudan geliyor.

`leaderboards` + `leaderboard_entries` anlık görüntü tabloları KULLANILMADI:
onları dolduracak bir zamanlayıcı yok (pg_cron kurulu değil). Sıralama okuma
anında hesaplanıyor — bu veri hacminde daha basit ve her zaman güncel.
Yavaşlarsa fonksiyon imzaları aynı kalarak o tablolara geçilebilir.

#### Görevler gerçeğe bağlandı (061)

`data/tasks.ts` sabit demo listesiydi (5 görev, 7 gün ödülü, hepsi yalan).
Artık `gorevler` + `kullanici_gorev_ilerlemesi` + `gunluk_giris_odulleri` +
`kullanici_gunluk_giris` tablolarından.

**İlerleme İSTEMCİDEN GELMİYOR.** "Görevi ilerlet" diye bir RPC yok; olsaydı
herkes kendi sayacını yazıp ödülü bedava alırdı. İlerleme her okumada kaynak
tablolardan sayılıyor: `oda_ziyaretleri`, `oda_mesajlari`, `hediye_gecmisi`
(gönderen ve alıcı), `kullanicilar_takip`. İlerleme tablosuna yalnızca
"ödül alındı" işareti düşüyor — o da (kullanıcı, görev, gün) üzerinde tekil
indeksle korunuyor.

- 5 günlük görev: odaya katıl, 10 mesaj, hediye gönder, hediye al, takip et.
- 7 günlük giriş serisi; bir gün atlanınca seri sunucuda sıfırlanıyor.
- Ödüller **altın** (elmas değil): elmas satın alınan varlık, onu bedava
  dağıtmak monetizasyonu deler. Ödül promo kaynaklı lot olarak yatıyor —
  hediyeye harcanabilir, çekilemez.
- Görev satırlarına ilerleme çubuğu eklendi ("4/10" tek başına ne kadar
  kaldığını göstermiyordu).

#### İki ayrı altın bakiyesi sorunu (062)

Mağaza/envanteri olduğu gibi bırakma kararı verildi (çalışıyor), ama altında
gerçek bir çatlak vardı: **059'dan sonra kullanıcının iki ayrı altını olacaktı.**

| | altını nereden düşürüyor | bakiyeyi nereden okuyor |
|---|---|---|
| Hediye (059) | `lot_harca` → `balance_lots` | `cached_altin_balance` |
| Mağaza (056) | `_bakiye_uygula` → `cuzdan` | `cuzdan` |

Altın yüklemesi (`admin_altin_yukle`) yalnız temel deftere yazdığı için mağaza
sürekli "Yetersiz altın" derdi; profil/cüzdan bir rakam, hediye kutusu başka
bir rakam gösterirdi.

`062` tabloları taşımıyor — `esyalar` / `kullanici_esyalari` yerinde. Yalnızca
altının **nereden düştüğü** ve **nereden okunduğu** tek yere çekiliyor:
`esya_satin_al` artık `lot_harca` kullanıyor, `benim_bakiyem()` temel şemanın
cache sütunlarını okuyor. İmza değişmediği için profil, cüzdan ve mağaza
ekranlarında tek satır değişmedi. Cüzdan hareketleri de `cuzdan_hareketleri`
yerine `wallet_ledger`dan geliyor (RPC yoksa eski tabloya düşüyor).

Eski `cuzdan` tablosu silinmedi; artık kimse okumuyor.

#### Enum etiketleri artık tahmin edilmiyor

`bakiye_kaynagi` ve `islem_tipi` temel şemanın enum'ları ve repoda tanımları
yok — dökümde yalnızca "USER-DEFINED" yazıyor. Etiketi tahmin edip yanlış
yazarsak hata ancak kullanıcı ödülü almaya çalışınca çıkardı. Bu yüzden
`_enum_etiket(tip, adaylar[])` yardımcısı eklendi: çalışma anında aday
listesinden var olanı seçiyor, hiçbiri tutmazsa **veritabanındaki gerçek
etiket listesini yazan** bir hata veriyor. Yani ilk denemede doğru etiket
öğrenilip tek satırda sabitlenebilir.

### 30 Ağustos — ikinci yarı: oda deneyimi ve rozetler

#### Enum etiketleri artık tahmin değil (063-064)

059-062 çalıştırıldıktan sonra `_enum_liste` ile gerçek etiketler okundu ve
`db/SEMA_DOKUMU.md`'ye **"Enum tipleri"** bölümü eklendi (23 tip). İki hata
çıktı:

- `_altin_harca` **kırıktı**: aday listesinde `magaza`/`satin_alma`/`harcama`
  vardı, gerçeği **`magaza_satin_alma`**. Hiçbir aday tutmadığı için her
  mağaza satın alması hata veriyordu.
- `_odul_ver` çalışıyordu ama yanlış kovaya yazıyordu (`bonus`+`admin_ekleme`
  seçiliyordu); doğrusu **`campaign`+`kampanya_odulu`**. `campaign` promo
  tarafına düşer: ödül altını hediyeye harcanır ama çekilemez.

> **YETKİ KURALI — pahalıya patlayan ders:** PostgreSQL yeni fonksiyona
> **PUBLIC**'e EXECUTE verir ve `anon` PUBLIC'in içindedir. `REVOKE … FROM anon`
> tek başına KAPATMAZ. Her yeni fonksiyonda önce `REVOKE ALL … FROM PUBLIC`,
> sonra hedef role `GRANT`. 064 tam bu yüzden gerekti.

Ölçüldü: 063+064 sonrası hediye/sıralama/görev/cüzdan RPC'lerinin hepsi ve
`hediyeler`/`esyalar`/`gorevler` tabloları giriş yapmamış birine **kapalı**
(42501).

#### Oda listesi canlı (065)

Yeni açılan oda listede 15-20 sn sonra beliriyordu. Sebep Supabase değil,
tasarımdı: liste yalnızca ekran ODAKLANDIĞINDA çekiliyordu, listeye bakarken
duruyorsan hiçbir sorgu atılmıyordu. "Oda boşalınca hemen gidiyor" da aynı
şeyin ters yüzüydü — odadan çıkıp listeye dönmek zaten bir odaklanma.

`odalar` tablosu Realtime yayınına alındı; her değişiklik (yeni oda,
katılımcı sayısı, ad, kapak, silme) anında düşüyor. 400 ms bekleme var, çünkü
oda açılırken INSERT'i hemen bir sayaç UPDATE'i izliyor.

#### Koltuk senkronu — asıl sebep bulundu

Metro logu koltuğun sıfırlanmadığını, **ekranın yeniden kurulduğunu** gösterdi:
oturunca `koltuk=0` iki kez yazılıyor, hemen ardından `koltuk=null` iki kez —
mount imzası.

- **Sebep:** `room.tsx` seçicisiz `useApp()` çağırıyordu → TÜM store'a abone.
  5 saniyede bir dönen hesap yasağı yoklamasının `set({banChecked:true})`'i
  bile ekranı baştan render ediyordu. Alan alan aboneye çevrildi.
- `mySeat`/`micOn` artık **store'da** (`appStore.koltugum`, oda kimliğiyle).
  Ekran yeniden kurulsa bile koltuk düşmüyor.
- `ch.subscribe` geri çağrısı kurulduğu andaki `presenceYaz`ı kapatıyordu
  (içinde `mySeat` hep null). Soket yeniden bağlanınca presence `koltuk: null`
  yazılıyordu → `presenceYazRef` ile hep tazesi çağrılıyor.
- Uygulama öne dönünce (`AppState`) presence tazeleniyor.

Doğrulandı: `[oda] UNMOUNT` artık yalnızca odadan çıkarken bir kez.

#### Giriş efekti kararsızlığı

Kural "önceki sync'te yoktu" idi. Hızlı çık-gir yapınca karşı taraf seni arada
hiç "yok" görmüyor (iki değişim tek diff'te birleşiyor) ve giriş kaçıyordu.
Artık presence yükündeki `katildi` damgasına bakıyor: damga ilerlemişse
yeniden girmiştir.

#### Kendi mesajım görünmüyordu

Metro logu: `Realtime send() is automatically falling back to REST API`.
Broadcast websocket yerine REST'e düşünce **gönderene echo edilmiyor**, yani
`self: true` çalışmıyor. Kendi odanda tek başınayken yazdığın mesaj hiç
görünmüyordu. Artık kendi mesajım yerel ekleniyor, echo gelirse eleniyor.

#### Oda alt barı yeniden kuruldu

Odaya girer girmez göze çarpan ilk şey ekranın altını kaplayan boş bir yazı
kutusuydu. Referans (WePlay/Yalla) düzenine geçildi:

- Koltukta **değilken**: `[hoparlör] [ Yaz … ] [☰] [el] [hediye]`
- Koltukta**yken**: `[hoparlör] [mikrofon] [emoji] [sohbet] [☰] [el] [hediye]`
  — hoparlör yerinde kalır, mikrofon ve emoji sağına eklenir, "Yaz …" hapı
  yuvarlak sohbet düğmesine küçülür.

"Yaz …" hapına dokununca satır yazma moduna geçiyor (@ düğmesi, "Lütfen
nazikçe konuşun" kutusu, gönder). ☰ → oda araçları ızgarası: Oda Profili,
Odadakiler, Mikrofon Sırası (rozetli), Katkı Sıralaması, Oda İstatistiği,
Oda Ayarları (yalnız sahip), Sesi Aç/Kapat, Şikayet Et. **Müzik ve Foto
konmadı** — arkalarında hiçbir şey yok, ölü düğme koymadık.

Sohbetin üzerinde yüzen el kaldırma düğmesi kalktı, alt bardaki yerine geçti.

#### Emoji tepkisi

Alt bardaki yüz düğmesinden seçilen emoji sohbete düşmüyor, gönderenin
**avatarını kaplayıp** kayboluyor (1,6 sn, yaylı giriş). Odadaki herkes
broadcast ile aynı anda görüyor. `Seat` tipine `uid` eklendi ki tepki doğru
koltuğa düşsün.

#### Yönetim menüsü + mikrofon daveti

Kullanıcı kartındaki dişli çıplak bir listeydi, üç satır aynı renkte. Artık
altın çizgili başlık (kimin üzerinde işlem yapıldığı yazıyor), renkli ikon
karesi ve **her satırın altında ne yaptığını söyleyen açıklama** —
"Mikrofondan İndir" ile "Odadan Çıkar" farkı eskiden yalnızca ikondan
anlaşılıyordu.

**Mikrofona davet:** oda sahibi ve yardımcı, koltukta olmayan birini
çağırabiliyor. Doğrudan oturtmuyor — hedefte onay kutusu açılıyor.

#### Oda rozetleri (066)

Rozetler `data/seed.ts` içindeki sahte odalara elle yazılmış sabitlerdi;
gerçek odalarda hiç görünmüyordu. Görseller (49 rozet) zaten hazırdı, eksik
olan veriydi. İki kaynak, tek görünüm:

- **kural** → okuma anında hesaplanır, tabloda durmaz. "Haftalık şampiyon"
  dün doğruysa bugün başkasının olabilir; anlık görüntü tutmak yanlış olurdu
  ve dolduracak zamanlayıcı da yok (060'la aynı gerekçe).
  Kaynaklar: `hediye_gecmisi`, `oda_ziyaretleri`, `oda_mesajlari`,
  `oda_seviyeleri`.
  11 rozet: haftalık şampiyon/2./3., hediye yağmuru, ateş serisi, popüler,
  sohbet ustası, gece kuşu, erkenci, yükselen yıldız, seviye ustası + `lv`.
- **elle** → `oda_rozetleri` tablosunda durur. Efsanevi, Etkinlik Ustası,
  VIP Oda, sezonluklar… 15 rozet. Yönetim ekranından (`admin-room-edit`)
  verilip geri alınabiliyor.

**Kural rozeti elle verilemez** — verilebilseydi liste yalan söylerdi;
`admin_oda_rozet_ver` bunu reddediyor.

### Sıradakiler

> **Karar (29-30 Ağustos):** ekonomide kendi paralel yapımızı değil **temel
> şemayı** kullanacağız — ama tablo tablo taşımak yerine yalnızca ÇAKIŞAN
> noktayı taşıyoruz. Hediye 059'la, altın bakiyesi 062'yle geçti; eşya
> tabloları (056) çalıştığı için yerinde bırakıldı.
>
> Çalıştırılmayı bekleyen migration listesi §10'un başında (2 Eylül: yalnız 053).

> **AÇIK İŞLER (2 Eylül, güncel):**
> - `053` çalıştırılacak — yönetim panelinde oda kapağı düğmeleri onsuz çalışmıyor
> - **İki cihazda temiz doğrulama turu yapılmadı.** 068-070 canlıda ama
>   koltuk/mikrofon/sıra/katılımcı akışları uçtan uca test edilmedi.
> - **"Sustur"** (başkasını susturma) hâlâ YEREL — sunucu RPC'si yok.
> - `CamZemin` yalnız 4 yüzeye uygulandı; GiftSheet, RoomStats, BottomNav,
>   RoomEntryGate, BadgeInfoModal hâlâ eski blur deseninde (Android'de saydam).
> - Oda sohbeti hâlâ DB'ye yazılmıyor (aşağıda 9. madde) — rozet kuralları
>   bu yüzden tetiklenmiyor.

1. ✅ **ODA LİSTESİ GÖRÜNÜRLÜĞÜ — BİTTİ (2 Eylül).** Kişi sayısı artık
   `oda_kisi_sayilari()` ile kalp atışlı `oda_katilimcilar` tablosundan
   geliyor; presence katmanı (`odaVarlik.ts`) tamamen silindi. Hayalet oda
   sorunu da kapandı (kalbi durmuş kayıt eleniyor). Boş odalar yalnız
   "Boş" sekmesinde.
   **Ders:** "iki zayıf kaynağın birleşimi" ara çözümdü ve hayalet odayı
   listede tutuyordu; doğru cevap kaynağı GÜÇLENDİRMEKTİ (durumu tabloya
   almak), zayıf kaynakları harmanlamak değil.
2. **Oda içi senkron hatası — sebep bulundu (30 Ağustos), doğrulanacak.**
   `ch.subscribe` geri çağrısı kurulduğu andaki `presenceYaz`ı kapatıyordu;
   içindeki `mySeat` hep `null`dı. Soket düşüp yeniden bağlanınca (iOS
   uygulama arkaplana alınınca soketi kapatır) Supabase aynı geri çağrıyı
   tekrar `SUBSCRIBED` ile çağırıyor ve presence `koltuk: null` olarak
   yeniden yazılıyordu → karşı tarafta mikrofondan düşüyordun ama odada
   görünmeye devam ediyordun. Artık `presenceYazRef` ile hep tazesi
   çağrılıyor, ayrıca uygulama öne dönünce (`AppState`) presence tazeleniyor.
   İki cihazda doğrulanınca `[presence]` teşhis logları **kaldırılacak**.
2. ~~Mağaza/envanter taşıması~~ — **yapılmayacak, karar 30 Ağustos.** 056'nın
   tabloları (`esyalar`/`kullanici_esyalari`) çalışıyor ve yerinde kalıyor;
   `magaza_esyalari`/`kullanici_envanteri` boş duruyor. Taşınan tek şey ALTIN
   oldu (062) — çakışan asıl nokta oydu.
3. ~~Cüzdan taşıması~~ — **062 ile yapıldı.** `benim_bakiyem()` ve
   `esya_satin_al` temel deftere (`balance_lots` + `cached_altin_balance`)
   bağlandı, hareketler `wallet_ledger`dan okunuyor. Kalan: elmas tarafı
   (satın alma / `elmas_altin_donustur`) hâlâ bağlı değil.
4. **Ajans + yayıncı** — `ajanslar`, `ajans_uyeleri`, `yayinci_odemeleri`
   bağlanacak; `kullanicilar` üzerinde yayıncı bayrağı yok, yönetimden
   atanacak bir alan gerekiyor.
5. **Para çekme gerçeğe** — `withdrawal_requests` + `cekim_talep_olustur`
   (hesap bilgisi `pii_sifrele` ile şifreli), `kur_oranlari.kazanc_kuru`.
6. **Elmas satın alma (IAP)** — `elmas_paketleri`, `satin_almalar`,
   `satin_alma_dogrula_fn`. Elmas → altın dönüşümü `elmas_altin_donustur`.
7. ~~Sıralama listeleri~~ — **060 ile yapıldı** (zenginlik/cazibe/odalar,
   dönem seçici). Kalan: ajans ve yayıncı sekmeleri, o kayıtlar oluşunca.
8. **DM'den hediye** — peer'ın dbId'si ekranda yok, gönderim yalnızca
   animasyon oynatıyor. "Tümü"ne gönderim de tek RPC ile yapılamıyor.
9. **Oda sohbeti veritabanına HİÇ yazılmıyor.** Sohbet yalnızca broadcast;
   `sendRoomMessage` repoda duruyor ama hiçbir yerden çağrılmıyor, yani
   `oda_mesajlari` hep boş. İki sonucu var: (a) sonradan giren sohbet
   geçmişini göremiyor, (b) **Sohbet Ustası / Gece Kuşu / Erkenci rozetleri
   asla tetiklenmiyor** (066 kurallarını o tabloya dayadı). Karar gerekiyor:
   sohbeti DB'ye de yazmak mı, o üç rozetin kuralını değiştirmek mi.
10. **Anon'a açık RPC denetimi yapılmadı.** 063/064 yalnızca 059-062'nin
    fonksiyonlarını kapattı. Ölçüldü: `benim_hesap_yasagim` ve
    `oda_katilimci_yaz` hâlâ anon anahtarla çağrılabiliyor. İkincisi
    içeride `benim_kullanici_id() IS NULL` kontrolüyle korunuyor (yazma
    olmuyor) ama **eski migration'ların tamamı taranmalı** — aynı desende
    korumasız olan varsa açık demektir.
11. **Hayalet odalar** — `aktif_katilimci_sayisi` yalnızca istemci yazıyor
   (odadaki en küçük uid). Uygulama zorla kapanırsa sayı >0 kalıyor.
   **Listede artık zarar vermiyor** (30 Ağustos: görünürlük presence'tan
   geliyor, sayaç yalnızca soğuk açılış yedeği) ama sayaç hâlâ bayat
   kalabiliyor ve onu **sıralama (060) ile yönetim ekranları okuyor**.
   Kalıcı çözüm sunucu tarafı presence ya da TTL (sayaç N dakikadır
   dokunulmadıysa 0 say).
12. ~~Oda rozet sistemi~~ — **066 ile yapıldı** (kural motoru + elle verme).
    Kalan: kullanıcı rozetleri hâlâ ayrı bir konu; oda rozetleri yalnızca
    oda listesinde çiziliyor, oda profilinde de gösterilmeli.
13. ~~Görev sistemi~~ — **061 ile yapıldı.** Kalan: haftalık görevler
    (`gorev_tipi` enum etiketleri bilinmiyor, önce öğrenilecek) ve başarımlar.
14. **Hazır avatarlar `i.pravatar.cc`'den geliyor** — dış servis + gerçek
    insan fotoğrafları; yayından önce kendi setimizle değiştirilmeli.
15. `RoomPanel`'deki "Takip Et" bitti, ama "Katıl" dışındaki oda rozetleri
    hâlâ mock.
16. Splash Expo Go'da görünmüyor · `expo-video` cihazda denenmedi ·
    paket sürüm uyumsuzluğu (`expo@54.0.35` → `~54.0.37`).

---

### Önceki oturum — Hesap yasağı sağlamlaştırma

- **EN SON İŞ — Hesap yasağı sağlamlaştırma:**
  - **Oda listesi flaşı giderildi:** `appStore.banChecked` state + `AppOverlays`
    opak örtü — oturum var ama ilk yasak kontrolü bitmemişken içerik gösterilmez;
    yasaklı kullanıcı bir an bile oda listesini görmez, doğrudan ban ekranı gelir.
  - **Anında kapı dışarı:** yasak yoklaması 10sn → **5sn** (realtime birincil,
    yoklama garanti); yasak görülünce `signOut` + tam ekran engel.
  - **Ban ekranı = aniden açılan merkez modal:** `AccountBanBlock` yeniden — kararan
    arka plan + `ZoomIn` ile pat diye açılan kart (sebep + süre + Çıkış Yap).
  - **Sistem DM'i (048):** `hesap_yasak_ver/kaldir` artık hedefe kalıcı Sistem DM'i
    bırakır (sebep+süre); yasaklı kişi ancak yasağı KALKINCA DM'de görür. Kalkınca
    da "yasağın kaldırıldı" mesajı. `npx tsc --noEmit` temiz.
  - Mic yasağı (room.tsx, 028) zaten sağlamdı — dokunulmadı.
- **Bu oturumda yapıldı (§9.5 ÖZEL ID SİSTEMİ — frontend tam):**
  - Aşama 1: level/role/special rozetleri normalize (hiza/boyut, VIP merkez).
  - Aşama 2b: **premium (≤5, 60 baked banner, listeden seç)** + **kapsül (6-7,
    25 kart teması + renk-uyumlu hap)** + düz (8+). appStore `ozelId/ozelIdTip/
    ozelIdTema` (demo). special-id claim akışı, profil gösterimi + kopyalama,
    beta yönlendirme banner'ı, sağ '>' oku → public self-önizleme (yetki DB'den).
  - Aşama 3: bilgi pencereleri (saydam, butonsuz, oto/dokunuş kapanır, fade).
  - `npx tsc --noEmit` temiz, `npx expo export --platform web` başarılı (her commit).
  - Oda rozetleri kullanıcı isteğiyle bu turda DEĞİŞTİRİLMEDİ.
- **ÖZEL ID BACKEND ARTIK TAMAM (§9.5 Aşama 2c — migration 044-047):**
  1. ✅ **DB'ye bağlandı:** `ozel_id`/`ozel_id_tip`/`ozel_id_tema` + gerçek
     `beta_tester`/`premium_hak` (044); `profileRepo` + store DB'den okur/yazar,
     `setOzelId/clearOzelId` RPC entitlement + basamak + benzersizlik zorlar.
  2. ✅ **Sistem DM hatırlatması:** 046 — beta + özel-id yok tespit edilince
     `betaKapsulHatirlat()` idempotent hedefli Sistem DM'i atar (bir kez).
  3. ✅ **Yeni kayıt 9+ hane:** 045 `yeni_public_id()` 9 haneye çıktı.
  4. ✅ **admin atama + entitlement:** 047 + `admin_hak_ata`; admin-user-edit
     Kimlik bölümünde "ÖZEL ID HAKLARI" beta/premium ver-al toggle'ları.
  - Ek: `2a8400b` profildeki "Demo · Beta Tester" toggle'ı kaldırıldı (artık
    DB'den geliyor), aramada özel ID de gösteriliyor.
- **KALAN (küçük):** Sistem DM mesajına tıklayınca `/special-id` derin-linki
  (şu an profil banner'ı yönlendiriyor). Oda ekonomisi + kapalı feature flag'ler
  (§7, §9) hâlâ bilinçli ertelenmiş durumda.
- **Son commit:** `2a8400b` — "profil: demo toggle'larını kaldır; aramada özel
  ID göster" (dal: `claude/metro-recovery-1xc2kq`, origin ile senkron).
- **`npx tsc --noEmit`:** temiz (0 hata) — doğrulandı.
- **Android + iOS bundle:** ikisi de sorunsuz derleniyor (bu sandbox'ta
  localhost:8081 üzerinden test edildi).
- **Cihazda görsel doğrulama YAPILAMADI** — §8'deki tünel kısıtı yüzünden.
  Kullanıcının kendi ortamında (teleport ya da kendi bilgisayarı) şunları
  test etmesi gerekiyor:
  1. Sekmeler arası hızlı geçiş → siyah ekran yok, yumuşak kayma var mı?
  2. iOS 26 cihazda tab bar gerçekten liquid glass mi görünüyor?
  3. Android'de DM/oda sohbeti/formlar açıkken klavye input'u kapatıyor mu,
     yoksa üstünde mi kalıyor?
- Bu doğrulamalar yapılıp bir sorun bulunursa, ince ayar tek noktadan
  (`KeyboardAware.tsx`, `BottomNav.tsx`, `(tabs)/_layout.tsx`) yapılabilir.
- **Henüz bir Pull Request açılmadı** — kullanıcı özellikle istemedikçe
  açılmayacak (talimat böyle).

## 11) Yeni Sohbete Nasıl Devam Edilir

1. Bu dosyayı (`PROJE_DURUMU.md`, repo kökünde) oku.
1b. **Migration yazmadan önce `db/SEMA_DOKUMU.md`’ye bak.** Temel şemanın
   repoda dosyası yok; orada zaten var olan bir tabloyu tekrar kurmaya
   çalışmak 058’de olduğu gibi çakışmaya yol açıyor (`hediyeler`).
   O döküm canlı veritabanından çıkarıldı: 104 tablo, 131 fonksiyon.
2. `git log --oneline -20` ile en son commit'leri teyit et (bu dosya
   güncel olmayabilir, git her zaman gerçek kaynak).
3. `db/migrations/` klasöründeki en yüksek numaralı dosyaya bak — DB şu an
   nerede kaldığını gösterir.
4. Kullanıcı yeni bir istek getirdiğinde önce mevcut deseni/repo katmanını
   kullan (§4 mimari kuralı) — sıfırdan yazma.
5. Ortam kısıtları (§8) tekrar araştırılmasın — doğrudan kullanıcıya
   teleport/lokal çalıştırma öner.
