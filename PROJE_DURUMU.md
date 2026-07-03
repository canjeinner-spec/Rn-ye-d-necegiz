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
  migrations/           → 001–043 sıralı SQL migration'lar (idempotent, tekrar
                           çalıştırılabilir — CREATE OR REPLACE / IF NOT EXISTS)
  HEPSI_020_043.sql     → 020'den 043'e kadar TEK YAPIŞTIRMA birleşik dosya
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

## 6) Veritabanı — Migration Listesi (db/migrations/, 001-043)

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

**Birleşik dosyalar:**
- `HEPSI_020_043.sql` — 020'den 043'e kadar hepsi tek yapıştırmada (025 önce,
  tek başına çalıştırılmalı — enum değeri ekleme kısıtı).
- `SON_035_036_037.sql` — sadece bu üçü ayrı çalıştırmak için.

**Temel şema (bu repoda dosyası yok, Supabase'te zaten kurulu):** `kullanicilar`,
`odalar`, `gonderiler` (akış), vb. — `schema_v7_eklentileri.sql` bunların
üstüne ek kolon/tablo ekliyor (feed, etkinlik, görev, kupon, özel ID,
arkadaşlık için).

## 7) Feature Flag'leri — MVP'de Kapalı Olanlar (`src/lib/features.ts`)

Bunlar **kodu/ekranı/rotası yerinde duran ama arayüzden gizlenmiş**
özellikler — bayrağı `true` yapmak yeterli, ekstra iş gerekmiyor:

```
roomGift: false        → Oda alt barındaki hediye ikonu
streamerPanel: false    → Profil menüsü "Yayıncı Paneli"
giftHistory: false      → Profil menüsü "Hediye Geçmişi"
giftCoupon: false       → Profil menüsü "Hediye Kuponu Gir"
store: false            → Profildeki "Mağaza" tile'ı
vip: false              → Profil menüsü "Aron VIP"
rankTab: false          → Alt navigasyon "Sıralama" sekmesi (sidebar'dan erişilir)
inventory: false        → Profildeki "Eşyalarım"
friends: false          → DM'deki "Arkadaşlık" kısayolu
events: false           → DM'deki "Etkinlik" kısayolu
notifications: true     → (AÇIK — Faz 3'te gerçekleşti)
visitors: false         → DM'deki "Ziyaretçi" kısayolu
profileGift: false      → Başkasının profilinde "Hediye Gönder"
dmGift: false           → DM sohbet kutusu hediye butonu
```

**Neden kapalı:** Hediye/gifting ve ona bağlı ekonomi (harcanan altın,
mağaza, VIP, envanter) **tamamen mock** — gerçek hediye→oda→altın defteri
kurulmadı. Kullanıcı bilinçli olarak bunu **erteledi** (bkz. §9).

## 8) Bilinen Ortam Kısıtları (ÖNEMLİ — tekrar araştırma, token/zaman kaybetme!)

Proje **Expo SDK 54** ile başlatıldı ve **Claude Code on the web** (bulut
sandbox) üzerinde geliştiriliyor. Kullanıcının fiziksel telefonu bu sandbox'a
**doğrudan bağlanamıyor**, bir tünel gerekiyor. İki farklı tünel mekanizması
**zaten denendi ve ikisi de bu sandbox'ta engelli** — aşağıdaki tespit tekrar
yapılmasın diye komutlarıyla birlikte yazıldı.

### Metro'yu başlatma komutları (hızlı referans)

```bash
# 1) Tünelsiz — SADECE bu sandbox içi test için (tsc/bundle doğrulama).
#    Kullanıcının telefonuna DIŞARIDAN GÖRÜNMEZ.
npx expo start --clear

# 2) ngrok tüneli (Expo'nun VARSAYILANI) — BU SANDBOX'TA ÇALIŞMAZ, deneme.
npx expo start --tunnel

# 3) "Bolt" / Expo'nun kendi WebSocket tüneli (ngrok yerine) — BU SANDBOX'TA
#    YİNE ÇALIŞMAZ ama komut budur, bir daha @expo/cli kaynağını didiklemeye
#    gerek yok:
EXPO_FORCE_WEBCONTAINER_ENV=1 npx expo start --tunnel
```

**"Bolt" tam olarak nedir:** ngrok değil — Expo CLI'nin kendi içinde gizli
bir mekanizma. `@expo/cli`'de `envIsWebcontainer()` true dönerse (bunu
`EXPO_FORCE_WEBCONTAINER_ENV=1` env değişkeni tetikler), tünel sağlayıcısı
olarak ngrok (`AsyncNgrok`) yerine **`AsyncWsTunnel`** (`@expo/ws-tunnel`
paketi) kullanılır — bu da **`wss://boltexpo.dev`**'e WebSocket bağlantısı
açar (koddaki gerçek hostname budur, "Bolt" adı buradan geliyor). Normalde
StackBlitz gibi tarayıcı-içi WebContainer ortamları için var, ama ngrok
binary/hesap gerektirmediği için herhangi bir kısıtlı ağda ilk denenecek
alternatiftir.

**Bu sandbox'taki durum (ikisi de test edildi, ikisi de ÇALIŞMIYOR):**
- `--tunnel` (ngrok): "ngrok tunnel took too long to connect" hatasıyla düşer
  ve **Metro'yu da beraberinde götürür**. Kök neden: sandbox'ın zorunlu egress
  proxy'si ngrok'un sertifika-pinning'ini desteklemiyor (proxy dokümanı
  `/root/.ccr/README.md` açıkça "desteklenmiyor, atlatmaya çalışma" diyor).
- `EXPO_FORCE_WEBCONTAINER_ENV=1 --tunnel` (Bolt/ws-tunnel): `boltexpo.dev`'e
  proxy üzerinden `curl` ile bağlantı denendi, **12 saniyede timeout** —
  domain allowlist'te değil + aynı proxy WebSocket upgrade'i muhtemelen
  protokol seviyesinde desteklemiyor. İstek proxy'nin hata loguna bile
  düşmüyor (sessizce yutuluyor).
- **Metro tünelsiz (`npx expo start`, komut 1) yerelde (localhost:8081)
  mükemmel çalışıyor** — bundle, tsc, her şey sorunsuz. Ama bu haliyle
  **kullanıcının telefonuna dışarıdan görünmüyor** (bu bulut ortamının resmi
  bir "port önizleme/port-forward" mekanizması da yok — docs'ta böyle bir
  özellik belgelenmemiş).

**Sonuç / doğru çözüm yolu:** Kod zaten GitHub'a push'lu. Kullanıcı gerçek
cihaz testi için ya (a) bu session'ı `claude --teleport` ile kendi
bilgisayarına çekmeli, ya da (b) dalı kendi makinesinde `git pull` edip
`npm install && npx expo start --tunnel` ile **kendi** internetinden
çalıştırmalı. Kendi bilgisayarında zorunlu egress proxy'si olmadığı için
ngrok (varsayılan, komut 2) orada sorunsuz çalışır — Bolt'a (komut 3) hiç
gerek kalmaz.

**Yeni oturumda bu ortamda tekrar denenecekse:** önce komut 1 ile Metro'nun
sağlıklı olduğunu doğrula (tsc/bundle), sonra sırayla komut 3 → komut 2 dene
(Bolt önce, çünkü hesap/binary gerektirmiyor) — ama muhtemelen ikisi de yine
başarısız olacak, zaman kaybetmemek için doğrudan teleport/lokal çalıştırma
önerisine geç.

Bu ortamın network access seviyesi (Trusted/Full/Custom) Claude Code web
arayüzünden environment ayarlarından değiştirilebilir ama sertifika-pinning
(ngrok) ve WebSocket-upgrade kısıtları muhtemelen "Full" seçilse bile aşılamaz
(proxy seviyesinde protokol kısıtı, domain allowlist sorunu değil).

## 9) Ertelenen / Bilinçli Olarak Yapılmayan İşler

- **Oda ekonomisi (harcanan altın + oda sıralaması):** Gifting/hediye→altın
  harcama sistemi tamamen mock olduğu için ERTELENDİ. Gerçek hediye→oda→altın
  defteri kurulunca (yukarıdaki feature flag'ler açılınca) eklenecek.
- **XP/seviye kuralları:** Temel XP sistemi var (026 migration) ama detaylı
  kurallar (hangi aksiyon kaç XP verir vb.) kullanıcı kararını bekliyor
  (dilim 6 notunda belirtilmiş, hâlâ açık).
- Yukarıdaki §7'deki tüm `false` feature flag'ler = bilinçli olarak MVP
  dışında bırakılan, ama kodu hazır duran özellikler.

## 10) Şu An Kaldığımız Yer

- **Son commit:** `3f592d4` — "Tab bar cilası + Android klavye düzeltmesi"
  (dal: `claude/metro-recovery-1xc2kq`, origin ile senkron, çalışma ağacı
  temiz).
- **`npx tsc --noEmit`:** temiz (0 hata) — bu commit'te doğrulandı.
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
2. `git log --oneline -20` ile en son commit'leri teyit et (bu dosya
   güncel olmayabilir, git her zaman gerçek kaynak).
3. `db/migrations/` klasöründeki en yüksek numaralı dosyaya bak — DB şu an
   nerede kaldığını gösterir.
4. Kullanıcı yeni bir istek getirdiğinde önce mevcut deseni/repo katmanını
   kullan (§4 mimari kuralı) — sıfırdan yazma.
5. Ortam kısıtları (§8) tekrar araştırılmasın — doğrudan kullanıcıya
   teleport/lokal çalıştırma öner.
