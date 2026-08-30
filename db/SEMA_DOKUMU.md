# Veritabanı Şeması — CANLI DÖKÜM

> Supabase üzerinden `information_schema` okunarak üretildi (29 Ağustos 2026).
> **104 tablo · 838 sütun · 131 fonksiyon · 23 enum tipi**
> (enum etiketleri 30 Ağustos'ta eklendi — aşağıdaki "Enum tipleri" bölümü)

Bu dosya neden var: temel şemanın (kullanicilar, odalar, hediyeler, cuzdanlar…)
repoda dosyası yok, doğrudan Supabase'te kurulmuş. Neyin zaten var olduğunu
bilmeden migration yazınca çakışıyoruz — nitekim 058'de `hediyeler` tablosu
çakıştı. Yeni migration yazmadan önce BURAYA bak.

## ⚠️ Bu dökümden SONRA eklenenler (30 Ağustos, 059-066)

> Aşağıdaki tablo ve fonksiyonlar **yukarıdaki listelerde YOK** — döküm
> 29 Ağustos'ta alındı, bunlar sonra eklendi. Migration yazmadan önce buraya
> da bak, yoksa var olanı tekrar kurmaya çalışırsın.

**Yeni tablolar**

| tablo | migration | ne tutuyor |
|---|---|---|
| `oda_rozet_katalogu` | 066 | kod, ad, aciklama, kaynak('kural'/'elle'), sira, aktif |
| `oda_rozetleri` | 066 | oda_id, kod, veren_id, sebep, verilme, bitis (yalnız ELLE verilenler) |

**Yeni sütunlar**

| tablo | sütunlar | migration |
|---|---|---|
| `hediyeler` | kod, emoji, renk1, renk2, kademe | 059 |

**Yeni fonksiyonlar**

| fonksiyon | migration | not |
|---|---|---|
| `hediye_gonder_v2(hediye_id, miktar, alici_id, oda_id, idem, mesaj)` | 059 | temel trigger'a giden sarmalayıcı |
| `benim_bakiyem_v2()`, `hediye_komisyon()` | 059 | |
| `kazanc_ozeti_v2()`, `kazanc_saatlik_v2(gun_once)`, `kazanc_gunluk_v2(gun)`, `son_hediyelerim_v2(limit)` | 059 | yayıncı paneli |
| `admin_altin_yukle(kullanici, miktar)` | 059/063 | `admin_grant` + `admin_ekleme` |
| `_enum_etiket(tip, adaylar[])`, `_enum_liste(tip)` | 059/061 | istemciye KAPALI |
| `_siralama_baslangic(periyot)`, `siralama_donem_bitis(periyot)` | 060 | dönem sınırı, Europe/Istanbul |
| `siralama_zenginlik / siralama_cazibe / siralama_odalar(periyot, limit)` | 060 | okuma anında hesaplanır |
| `_bugun_tr()`, `gorevlerim()`, `gorev_odul_al(kod)` | 061 | ilerleme TÜRETİLİR, yazılmaz |
| `gunluk_giris_durum()`, `gunluk_giris_al()` | 061 | 7 günlük seri |
| `_odul_ver(kullanici, miktar, ref)` | 061/063 | `campaign` + `kampanya_odulu` |
| `_altin_harca(kullanici, miktar, ref)` | 062/063 | `magaza_satin_alma` |
| `esya_satin_al(esya_id)` | 062 | ARTIK `lot_harca` kullanıyor, eski `cuzdan` değil |
| `benim_bakiyem()` | 062 | ARTIK `cached_*` sütunlarını okuyor |
| `hareketlerim_v2(limit)` | 062 | `wallet_ledger`dan |
| `oda_rozetleri_getir(oda_ids[])` | 066 | kural + elle, tek listede |
| `admin_oda_rozet_ver / _al / _listesi` | 066 | kural rozeti elle verilemez |

**Realtime yayını:** `odalar` tablosu `supabase_realtime` yayınına eklendi (065).

**Yetki kuralı:** PostgreSQL yeni fonksiyona PUBLIC'e EXECUTE verir ve `anon`
PUBLIC'in içindedir. `REVOKE ... FROM anon` tek başına KAPATMAZ — önce
`REVOKE ALL ... FROM PUBLIC`, sonra hedef role `GRANT`.


## Tablolar

### admin_logs

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('admin_logs_id_seq'::regclass) |
| acting_admin_id | bigint | evet |  |
| target_user_id | bigint | evet |  |
| action_type | character varying | hayır |  |
| old_value | jsonb | evet |  |
| new_value | jsonb | evet |  |
| ip_adresi | inet | evet |  |
| sebep | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### ajans_uyeleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('ajans_uyeleri_id_seq'::regclass) |
| ajans_id | integer | hayır |  |
| kullanici_id | bigint | hayır |  |
| rol | USER-DEFINED | hayır | 'yayinci'::ajans_rolu |
| para_birimi | character varying | evet |  |
| kota_hedefi | bigint | hayır | 0 |
| katilim_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| ayrilma_tarihi | timestamp with time zone | evet |  |
| aktif | boolean | hayır | true |

### ajanslar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('ajanslar_id_seq'::regclass) |
| public_id | character varying | hayır |  |
| ad | character varying | hayır |  |
| sahip_id | bigint | evet |  |
| komisyon_orani | numeric | hayır | 0.10 |
| odeme_gunu | smallint | hayır | 1 |
| varsayilan_para_birimi | character varying | hayır |  |
| aktif | boolean | hayır | true |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### arkadasliklar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('arkadasliklar_id_seq'::regclass) |
| isteyen_id | bigint | hayır |  |
| istenen_id | bigint | hayır |  |
| durum | USER-DEFINED | hayır | 'beklemede'::arkadaslik_durumu |
| istek_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| yanit_tarihi | timestamp with time zone | evet |  |

### ayarlar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| anahtar | character varying | hayır |  |
| deger | text | hayır |  |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### balance_lots

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('balance_lots_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| varlik | USER-DEFINED | hayır |  |
| kaynak | USER-DEFINED | hayır |  |
| baslangic_miktar | bigint | hayır |  |
| kalan_miktar | bigint | hayır |  |
| referans_tip | character varying | evet |  |
| referans_id | bigint | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### balance_lots_arsiv

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('balance_lots_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| varlik | USER-DEFINED | hayır |  |
| kaynak | USER-DEFINED | hayır |  |
| baslangic_miktar | bigint | hayır |  |
| kalan_miktar | bigint | hayır |  |
| referans_tip | character varying | evet |  |
| referans_id | bigint | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| arsiv_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### bildirimler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('bildirimler_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| tip | USER-DEFINED | hayır |  |
| baslik | character varying | evet |  |
| icerik | text | evet |  |
| veri | jsonb | evet |  |
| okundu | boolean | hayır | false |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### cuzdan

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| elmas | bigint | hayır | 0 |
| altin | bigint | hayır | 0 |
| guncelleme | timestamp with time zone | hayır | now() |
| elmas_dondu | boolean | hayır | false |
| altin_dondu | boolean | hayır | false |

### cuzdan_hareketleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('cuzdan_hareketleri_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| varlik | text | hayır |  |
| miktar | bigint | hayır |  |
| sebep | text | evet |  |
| yapan_id | bigint | evet |  |
| tarih | timestamp with time zone | hayır | now() |

### cuzdanlar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('cuzdanlar_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| para_birimi | character varying | hayır |  |
| bakiye | bigint | hayır | 0 |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### device_history

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('device_history_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| platform | USER-DEFINED | hayır |  |
| device_fingerprint | character varying | evet |  |
| push_token | text | evet |  |
| ilk_gorulme | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| son_aktif_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### dm_konusmalari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('dm_konusmalari_id_seq'::regclass) |
| kullanici1_id | bigint | hayır |  |
| kullanici2_id | bigint | hayır |  |
| son_mesaj_tarihi | timestamp with time zone | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### dm_mesajlari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('dm_mesajlari_id_seq'::regclass) |
| konusma_id | bigint | hayır |  |
| gonderen_id | bigint | hayır |  |
| icerik | text | hayır |  |
| okunma_tarihi | timestamp with time zone | evet |  |
| gonderen_sildi | boolean | hayır | false |
| alici_sildi | boolean | hayır | false |
| gonderilme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### duyuru_bannerlari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('duyuru_bannerlari_id_seq'::regclass) |
| baslik | text | hayır |  |
| aciklama | text | evet |  |
| foto_url | text | evet |  |
| sira | integer | hayır | 0 |
| aktif | boolean | hayır | true |
| olusturma | timestamp with time zone | hayır | now() |
| sablon | text | hayır | 'duyuru'::text |
| icerik | jsonb | hayır | '{}'::jsonb |

### economy_restrictions

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('economy_restrictions_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| kisit_tipi | character varying | hayır |  |
| sebep | text | evet |  |
| uygulayan_id | bigint | evet |  |
| baslangic_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| bitis_tarihi | timestamp with time zone | evet |  |
| aktif | boolean | hayır | true |

### elmas_paketleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('elmas_paketleri_id_seq'::regclass) |
| ad | character varying | hayır |  |
| elmas_miktari | bigint | hayır |  |
| fiyat | bigint | hayır |  |
| para_birimi | character varying | hayır |  |
| magaza_urun_kodu | character varying | hayır |  |
| aktif | boolean | hayır | true |

### elmas_transferleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('elmas_transferleri_id_seq'::regclass) |
| gonderen_id | bigint | hayır |  |
| alici_id | bigint | hayır |  |
| miktar | bigint | hayır |  |
| durum | USER-DEFINED | hayır | 'tamamlandi'::transfer_durumu |
| idempotency_key | character varying | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### esyalar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | text | hayır |  |
| tip | text | hayır |  |
| ad | text | hayır |  |
| aciklama | text | evet |  |
| tema | text | hayır |  |
| nadirlik | text | hayır | 'standart'::text |
| fiyat_altin | bigint | hayır | 0 |
| sure_gun | integer | evet |  |
| aktif | boolean | hayır | true |
| sira | integer | hayır | 0 |

### etkinlik_katilimlari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('etkinlik_katilimlari_id_seq'::regclass) |
| etkinlik_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| katilim_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### etkinlikler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('etkinlikler_id_seq'::regclass) |
| public_id | character varying | hayır |  |
| ad | character varying | hayır |  |
| aciklama | text | evet |  |
| kapak_url | text | evet |  |
| tip | character varying | evet |  |
| durum | USER-DEFINED | hayır | 'taslak'::etkinlik_durumu |
| oda_id | bigint | evet |  |
| baslangic_tarihi | timestamp with time zone | evet |  |
| bitis_tarihi | timestamp with time zone | evet |  |
| odul_aciklama | text | evet |  |
| odul_meta | jsonb | evet |  |
| katilimci_sayisi | integer | hayır | 0 |
| aktif | boolean | hayır | true |
| olusturan_id | bigint | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### feature_flags

| sütun | tip | null | varsayılan |
|---|---|---|---|
| anahtar | character varying | hayır |  |
| aktif | boolean | hayır | false |
| aciklama | text | evet |  |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### gonderi_begeniler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| gonderi_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| begeni_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### gonderi_medya

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('gonderi_medya_id_seq'::regclass) |
| gonderi_id | bigint | hayır |  |
| medya_url | text | hayır |  |
| tip | character varying | hayır | 'foto'::character varying |
| sira | smallint | hayır | 0 |

### gonderi_yorum_begeniler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| yorum_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| begeni_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### gonderi_yorumlari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('gonderi_yorumlari_id_seq'::regclass) |
| gonderi_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| ust_yorum_id | bigint | evet |  |
| icerik | text | hayır |  |
| begeni_sayisi | integer | hayır | 0 |
| silinmis | boolean | hayır | false |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### gonderiler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('gonderiler_id_seq'::regclass) |
| public_id | character varying | hayır |  |
| kullanici_id | bigint | hayır |  |
| icerik | text | evet |  |
| kapsam | USER-DEFINED | hayır | 'herkes'::gonderi_kapsami |
| begeni_sayisi | integer | hayır | 0 |
| yorum_sayisi | integer | hayır | 0 |
| paylasim_sayisi | integer | hayır | 0 |
| duzenlendi | boolean | hayır | false |
| guncelleyen_id | bigint | evet |  |
| silen_id | bigint | evet |  |
| silinmis | boolean | hayır | false |
| silinme_tarihi | timestamp with time zone | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| sabitlenmis | boolean | hayır | false |

### gorevler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('gorevler_id_seq'::regclass) |
| kod | character varying | hayır |  |
| ad | character varying | hayır |  |
| aciklama | text | evet |  |
| tip | USER-DEFINED | hayır | 'gunluk'::gorev_tipi |
| hedef_sayi | integer | hayır | 1 |
| odul_varlik | USER-DEFINED | hayır | 'altin'::varlik_tipi |
| odul_miktar | bigint | hayır | 0 |
| ikon_url | text | evet |  |
| sira | integer | hayır | 0 |
| aktif | boolean | hayır | true |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### gunluk_giris_odulleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| gun_no | smallint | hayır |  |
| varlik | USER-DEFINED | hayır | 'altin'::varlik_tipi |
| miktar | bigint | hayır |  |
| ikon_url | text | evet |  |

### hediye_gecmisi

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('hediye_gecmisi_id_seq'::regclass) |
| gonderen_id | bigint | evet |  |
| alici_id | bigint | hayır |  |
| hediye_id | integer | hayır |  |
| miktar | integer | hayır | 1 |
| birim_fiyat | bigint | hayır | 0 |
| toplam_deger | bigint | hayır | 0 |
| komisyon_orani | numeric | hayır | 0 |
| kazanc_miktari | bigint | hayır | 0 |
| platform_geliri | bigint | hayır | 0 |
| oda_id | bigint | evet |  |
| mesaj | text | evet |  |
| idempotency_key | character varying | evet |  |
| gonderilme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### hediye_gonderimleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('hediye_gonderimleri_id_seq'::regclass) |
| gonderen_id | bigint | hayır |  |
| alici_id | bigint | hayır |  |
| oda_id | bigint | evet |  |
| hediye_id | text | hayır |  |
| adet | integer | hayır |  |
| birim_elmas | bigint | hayır |  |
| toplam_elmas | bigint | hayır |  |
| kazanc_altin | bigint | hayır |  |
| komisyon_altin | bigint | hayır |  |
| tarih | timestamp with time zone | hayır | now() |

### hediye_katalogu

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | text | hayır |  |
| sekme | integer | hayır | 0 |
| ad | text | hayır |  |
| emoji | text | hayır |  |
| fiyat_elmas | bigint | hayır |  |
| kademe | text | hayır | 'normal'::text |
| aktif | boolean | hayır | true |

### hediyeler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('hediyeler_id_seq'::regclass) |
| ad | character varying | hayır |  |
| kategori | character varying | evet |  |
| birim_fiyat | bigint | hayır | 0 |
| ikon_url | text | evet |  |
| animasyon_url | text | evet |  |
| sira | integer | hayır | 0 |
| aktif | boolean | hayır | true |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### hesap_yasaklari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| sebep | text | evet |  |
| yasaklayan_id | bigint | evet |  |
| bitis | timestamp with time zone | evet |  |
| olusturma | timestamp with time zone | hayır | now() |

### idempotency_keys

| sütun | tip | null | varsayılan |
|---|---|---|---|
| anahtar | character varying | hayır |  |
| kapsam | character varying | hayır |  |
| kullanici_id | bigint | evet |  |
| sonuc_ref_tip | character varying | evet |  |
| sonuc_ref_id | bigint | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### kaynak_kurallari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kaynak | USER-DEFINED | hayır |  |
| cekilebilir | boolean | hayır | false |
| transfer_edilebilir | boolean | hayır | false |
| donusturulebilir | boolean | hayır | true |
| cekim_orani | numeric | hayır | 0 |
| donusum_orani | numeric | hayır | 1 |
| kazanc_orani | numeric | hayır | 0 |
| oncelik | smallint | hayır | 100 |

### kullanici_engelleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| engelleyen_id | bigint | hayır |  |
| engellenen_id | bigint | hayır |  |
| engellenme_tarihi | timestamp with time zone | hayır | now() |

### kullanici_envanteri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kullanici_envanteri_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| esya_id | integer | hayır |  |
| edinme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| bitis_tarihi | timestamp with time zone | evet |  |
| kusanildi | boolean | hayır | false |

### kullanici_esyalari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| esya_id | text | hayır |  |
| edinme | timestamp with time zone | hayır | now() |
| bitis | timestamp with time zone | evet |  |
| kusanildi | boolean | hayır | false |

### kullanici_gorev_ilerlemesi

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kullanici_gorev_ilerlemesi_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| gorev_id | integer | hayır |  |
| donem_anahtari | character varying | hayır |  |
| ilerleme | integer | hayır | 0 |
| tamamlandi | boolean | hayır | false |
| odul_alindi | boolean | hayır | false |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### kullanici_gunluk_giris

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| mevcut_seri | integer | hayır | 0 |
| son_alinan_gun | smallint | hayır | 0 |
| son_giris_tarihi | date | evet |  |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### kullanici_kimlikleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kullanici_kimlikleri_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| saglayici | USER-DEFINED | hayır |  |
| saglayici_uid | character varying | hayır |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### kullanici_rozetleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kullanici_rozetleri_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| rozet_id | integer | hayır |  |
| kazanma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### kullanici_vip

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kullanici_vip_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| vip_id | integer | hayır |  |
| baslangic_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| bitis_tarihi | timestamp with time zone | hayır |  |

### kullanicilar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kullanicilar_id_seq'::regclass) |
| public_id | character varying | hayır |  |
| kullanici_adi | character varying | hayır |  |
| email | character varying | evet |  |
| telefon | character varying | evet |  |
| sifre_hash | text | evet |  |
| deneyim_puani | bigint | hayır | 0 |
| seviye_id | integer | evet |  |
| profil_resmi | text | evet |  |
| biyografi | text | evet |  |
| dogum_tarihi | date | evet |  |
| ulke | character varying | evet |  |
| sehir | character varying | evet |  |
| durum | USER-DEFINED | hayır | 'cevrimdisi'::kullanici_durumu |
| son_gorulme | timestamp with time zone | evet |  |
| son_cevrimici | timestamp with time zone | evet |  |
| son_giris_tarihi | timestamp with time zone | evet |  |
| ekonomi_rolu | USER-DEFINED | hayır | 'standart'::ekonomi_rolu |
| cached_total_balance | bigint | hayır | 0 |
| cached_withdrawable_balance | bigint | hayır | 0 |
| cached_promo_balance | bigint | hayır | 0 |
| cached_altin_balance | bigint | hayır | 0 |
| kazanc_puani | bigint | hayır | 0 |
| economy_frozen | boolean | hayır | false |
| withdrawal_blocked | boolean | hayır | false |
| transfer_blocked | boolean | hayır | false |
| gift_blocked | boolean | hayır | false |
| coin_conversion_blocked | boolean | hayır | false |
| kyc_status | USER-DEFINED | hayır | 'yok'::kyc_durumu |
| kyc_verified_at | timestamp with time zone | evet |  |
| withdrawal_enabled | boolean | hayır | false |
| risk_score | smallint | hayır | 0 |
| banli | boolean | hayır | false |
| ban_bitis_tarihi | timestamp with time zone | evet |  |
| olusturan_id | bigint | evet |  |
| guncelleyen_id | bigint | evet |  |
| silen_id | bigint | evet |  |
| silinmis | boolean | hayır | false |
| silinme_tarihi | timestamp with time zone | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| cinsiyet | character varying | evet |  |
| auth_uid | uuid | evet |  |
| ozel_id | text | evet |  |
| ozel_id_tip | text | evet |  |
| ozel_id_tema | text | evet |  |
| beta_tester | boolean | hayır | false |
| premium_hak | boolean | hayır | false |
| beta_kapsul_hatirlatildi | boolean | hayır | false |
| kusanilan_rozet | text | evet |  |

### kullanicilar_takip

| sütun | tip | null | varsayılan |
|---|---|---|---|
| takip_eden_id | bigint | hayır |  |
| takip_edilen_id | bigint | hayır |  |
| bildirim_acik | boolean | hayır | true |
| takip_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### kupon_kullanimlari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kupon_kullanimlari_id_seq'::regclass) |
| kupon_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| varlik | USER-DEFINED | hayır |  |
| miktar | bigint | hayır |  |
| idempotency_key | character varying | evet |  |
| kullanim_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### kuponlar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kuponlar_id_seq'::regclass) |
| kod | character varying | hayır |  |
| varlik | USER-DEFINED | hayır | 'elmas'::varlik_tipi |
| miktar | bigint | hayır |  |
| toplam_limit | integer | evet |  |
| kullanim_sayisi | integer | hayır | 0 |
| kullanici_basina_limit | integer | hayır | 1 |
| baslangic_tarihi | timestamp with time zone | evet |  |
| bitis_tarihi | timestamp with time zone | evet |  |
| aktif | boolean | hayır | true |
| olusturan_id | bigint | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### kur_oranlari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('kur_oranlari_id_seq'::regclass) |
| para_birimi | character varying | hayır |  |
| elmas_kuru | numeric | hayır |  |
| kazanc_kuru | numeric | hayır |  |
| gecerlilik_baslangic | timestamp with time zone | hayır | CURRENT_TIMESTAMP |
| aktif | boolean | hayır | true |

### kyc_requests

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('kyc_requests_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| belge_tipi | character varying | evet |  |
| belge_veri_sifreli | bytea | evet |  |
| durum | USER-DEFINED | hayır | 'beklemede'::kyc_durumu |
| inceleyen_id | bigint | evet |  |
| red_sebebi | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| sonuclanma_tarihi | timestamp with time zone | evet |  |

### leaderboard_entries

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('leaderboard_entries_id_seq'::regclass) |
| leaderboard_id | integer | hayır |  |
| kullanici_id | bigint | evet |  |
| oda_id | bigint | evet |  |
| ajans_id | integer | evet |  |
| puan | bigint | hayır | 0 |
| sira | integer | evet |  |

### leaderboards

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('leaderboards_id_seq'::regclass) |
| tip | USER-DEFINED | hayır |  |
| donem_anahtari | character varying | hayır |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### login_history

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('login_history_id_seq'::regclass) |
| kullanici_id | bigint | evet |  |
| saglayici | USER-DEFINED | evet |  |
| ip_adresi | inet | evet |  |
| device_fingerprint | character varying | evet |  |
| ulke | character varying | evet |  |
| sehir | character varying | evet |  |
| basarili | boolean | hayır |  |
| hata_sebebi | character varying | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### magaza_esyalari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('magaza_esyalari_id_seq'::regclass) |
| ad | character varying | hayır |  |
| tip | USER-DEFINED | hayır |  |
| fiyat_elmas | bigint | hayır |  |
| sure_gun | integer | evet |  |
| gorsel_url | text | evet |  |
| animasyon_url | text | evet |  |
| aktif | boolean | hayır | true |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### mic_yasaklari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| sebep | text | evet |  |
| yasaklayan_id | bigint | evet |  |
| bitis | timestamp with time zone | evet |  |
| olusturma | timestamp with time zone | hayır | now() |

### oda_hareket_log

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('oda_hareket_log_id_seq'::regclass) |
| oda_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| tip | text | hayır |  |
| tarih | timestamp with time zone | hayır | now() |

### oda_katilimcilar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| oda_id | bigint | hayır |  |
| session_id | uuid | hayır | gen_random_uuid() |
| giris_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| last_heartbeat | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### oda_koltuklari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| oda_id | bigint | hayır |  |
| koltuk_no | smallint | hayır |  |
| kullanici_id | bigint | evet |  |
| kilitli | boolean | hayır | false |
| susturulmus | boolean | hayır | false |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### oda_mesajlari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('oda_mesajlari_id_seq'::regclass) |
| oda_id | bigint | hayır |  |
| kullanici_id | bigint | evet |  |
| icerik | text | hayır |  |
| gonderilme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### oda_seviyeleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('oda_seviyeleri_id_seq'::regclass) |
| ad | character varying | hayır |  |
| minimum_deneyim_puani | bigint | hayır | 0 |
| maks_katilimci_bonusu | integer | hayır | 0 |
| ikon_url | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### oda_takip

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| oda_id | bigint | hayır |  |
| tarih | timestamp with time zone | hayır | now() |

### oda_uyeleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| oda_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| rol | text | hayır | 'uye'::text |
| katilma_tarihi | timestamp with time zone | hayır | now() |

### oda_yasaklari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| oda_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| yasaklayan_id | bigint | evet |  |
| yasaklanma_tarihi | timestamp with time zone | hayır | now() |

### oda_yetkileri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('oda_yetkileri_id_seq'::regclass) |
| oda_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| rol | USER-DEFINED | hayır | 'uye'::oda_rolu |
| atama_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### oda_ziyaretleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| oda_id | bigint | hayır |  |
| son_giris | timestamp with time zone | hayır | now() |
| giris_sayisi | integer | hayır | 1 |

### odalar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('odalar_id_seq'::regclass) |
| public_id | character varying | hayır |  |
| ad | character varying | hayır |  |
| aciklama | text | evet |  |
| kategori | character varying | evet |  |
| kapak_url | text | evet |  |
| herkese_acik | boolean | hayır | true |
| sifre_hash | text | evet |  |
| olusturan_id | bigint | evet |  |
| oda_seviyesi_id | integer | evet |  |
| toplam_deneyim | bigint | hayır | 0 |
| koltuk_sayisi | smallint | hayır | 8 |
| temel_kapasite | integer | hayır | 20 |
| aktif_katilimci_sayisi | integer | hayır | 0 |
| guncelleyen_id | bigint | evet |  |
| silen_id | bigint | evet |  |
| silinmis | boolean | hayır | false |
| silinme_tarihi | timestamp with time zone | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| resmi | boolean | hayır | false |
| gunluk_sira | smallint | evet |  |
| islem_gordu | boolean | hayır | false |
| islem_sebep | text | evet |  |
| islem_tarihi | timestamp with time zone | evet |  |

### oturumlar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | uuid | hayır | gen_random_uuid() |
| kullanici_id | bigint | hayır |  |
| refresh_token_hash | text | hayır |  |
| ip_adresi | inet | evet |  |
| cihaz_bilgisi | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| son_kullanim_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| gecerlilik_bitis | timestamp with time zone | hayır |  |
| iptal | boolean | hayır | false |

### outbox_events

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('outbox_events_id_seq'::regclass) |
| olay_tipi | character varying | hayır |  |
| payload | jsonb | hayır |  |
| durum | USER-DEFINED | hayır | 'beklemede'::outbox_durumu |
| deneme_sayisi | smallint | hayır | 0 |
| sonraki_deneme | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| islenme_tarihi | timestamp with time zone | evet |  |

### ozel_id_satislari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('ozel_id_satislari_id_seq'::regclass) |
| ozel_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| fiyat_elmas | bigint | hayır |  |
| idempotency_key | character varying | evet |  |
| satin_alma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### ozel_idler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('ozel_idler_id_seq'::regclass) |
| deger | character varying | hayır |  |
| tier | USER-DEFINED | hayır | 'normal'::ozel_id_tier |
| fiyat_elmas | bigint | hayır | 0 |
| sure_gun | integer | evet |  |
| durum | USER-DEFINED | hayır | 'musait'::ozel_id_durumu |
| sahip_id | bigint | evet |  |
| edinme_tarihi | timestamp with time zone | evet |  |
| bitis_tarihi | timestamp with time zone | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### para_birimleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kod | character varying | hayır |  |
| ad | character varying | hayır |  |
| sembol | character varying | evet |  |
| minor_unit | smallint | hayır | 2 |
| aktif | boolean | hayır | true |

### platform_ayarlari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| anahtar | text | hayır |  |
| deger | numeric | hayır |  |
| aciklama | text | evet |  |

### profil_ziyaretleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('profil_ziyaretleri_id_seq'::regclass) |
| ziyaret_eden_id | bigint | hayır |  |
| ziyaret_edilen_id | bigint | hayır |  |
| ziyaret_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### raporlar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('raporlar_id_seq'::regclass) |
| raporlayan_id | bigint | evet |  |
| raporlanan_id | bigint | hayır |  |
| oda_id | bigint | evet |  |
| sebep | character varying | hayır |  |
| detay | text | evet |  |
| durum | USER-DEFINED | hayır | 'acik'::rapor_durumu |
| inceleyen_id | bigint | evet |  |
| sonuc | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| kapatilma_tarihi | timestamp with time zone | evet |  |

### reconciliation_snapshots

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('reconciliation_snapshots_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| varlik | USER-DEFINED | hayır |  |
| lot_toplami | bigint | hayır |  |
| cache_degeri | bigint | hayır |  |
| ledger_net | bigint | hayır |  |
| fark | bigint | hayır |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### referral_rewards

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('referral_rewards_id_seq'::regclass) |
| referral_id | bigint | hayır |  |
| kullanici_id | bigint | hayır |  |
| varlik | USER-DEFINED | hayır |  |
| miktar | bigint | hayır |  |
| verildi | boolean | hayır | false |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### referrals

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('referrals_id_seq'::regclass) |
| davet_eden_id | bigint | hayır |  |
| davet_edilen_id | bigint | hayır |  |
| referans_kodu | character varying | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### risk_events

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('risk_events_id_seq'::regclass) |
| kullanici_id | bigint | evet |  |
| olay_tipi | character varying | hayır |  |
| puan_etkisi | smallint | hayır | 0 |
| detay | jsonb | evet |  |
| ip_adresi | inet | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### risk_flags

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('risk_flags_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| bayrak | character varying | hayır |  |
| aktif | boolean | hayır | true |
| detay | jsonb | evet |  |
| olusturan_id | bigint | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| cozulme_tarihi | timestamp with time zone | evet |  |

### role_change_logs

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('role_change_logs_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| rol_id | integer | evet |  |
| islem | character varying | hayır |  |
| yapan_id | bigint | evet |  |
| sebep | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### room_moderation_logs

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('room_moderation_logs_id_seq'::regclass) |
| oda_id | bigint | hayır |  |
| uygulayan_id | bigint | evet |  |
| hedef_id | bigint | evet |  |
| tip | USER-DEFINED | hayır |  |
| detay | jsonb | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### room_stat_deltalari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('room_stat_deltalari_id_seq'::regclass) |
| oda_id | bigint | hayır |  |
| hediye_adedi | integer | hayır | 0 |
| coin | bigint | hayır | 0 |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### room_statistics

| sütun | tip | null | varsayılan |
|---|---|---|---|
| oda_id | bigint | hayır |  |
| toplam_hediye_adedi | bigint | hayır | 0 |
| toplam_coin | bigint | hayır | 0 |
| siralama_puani | bigint | hayır | 0 |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### rozetler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('rozetler_id_seq'::regclass) |
| ad | character varying | hayır |  |
| aciklama | text | evet |  |
| ikon_url | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| kod | text | evet |  |
| kategori | text | evet |  |
| sira | integer | hayır | 0 |
| aktif | boolean | hayır | true |
| kural_metrik | text | evet |  |
| kural_esik | integer | evet |  |

### satin_almalar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('satin_almalar_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| paket_id | integer | evet |  |
| platform | USER-DEFINED | hayır |  |
| makbuz_no | text | hayır |  |
| makbuz_veri_sifreli | bytea | evet |  |
| tutar | bigint | hayır |  |
| para_birimi | character varying | hayır |  |
| elmas_miktari | bigint | hayır |  |
| durum | USER-DEFINED | hayır | 'beklemede'::satin_alma_durumu |
| idempotency_key | character varying | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| dogrulanma_tarihi | timestamp with time zone | evet |  |

### seviyeler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('seviyeler_id_seq'::regclass) |
| ad | character varying | hayır |  |
| minimum_deneyim_puani | bigint | hayır | 0 |
| ikon_url | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### sikayetler

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('sikayetler_id_seq'::regclass) |
| tip | text | hayır |  |
| raporlayan_id | bigint | hayır |  |
| hedef_kullanici_id | bigint | evet |  |
| hedef_oda_id | bigint | evet |  |
| neden | text | hayır |  |
| detay | text | evet |  |
| durum | text | hayır | 'bekliyor'::text |
| olusturulma_tarihi | timestamp with time zone | hayır | now() |
| oda_katilimcilar | jsonb | evet |  |

### sistem_duyurulari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('sistem_duyurulari_id_seq'::regclass) |
| kanal | text | hayır | 'aron'::text |
| baslik | text | hayır |  |
| icerik | text | hayır |  |
| foto_url | text | evet |  |
| gonderen_id | bigint | evet |  |
| olusturma | timestamp with time zone | hayır | now() |
| hedef_kullanici_id | bigint | evet |  |
| tur | text | hayır | 'mesaj'::text |

### sistem_hesaplari

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kod | character varying | hayır |  |
| varlik | USER-DEFINED | hayır |  |
| bakiye | bigint | hayır | 0 |
| aciklama | text | evet |  |
| guncellenme_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### sistem_rolleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('sistem_rolleri_id_seq'::regclass) |
| kod | USER-DEFINED | hayır |  |
| ad | character varying | hayır |  |
| yetkiler | jsonb | hayır | '{}'::jsonb |

### user_limit_usage

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('user_limit_usage_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| limit_tipi | character varying | hayır |  |
| donem_anahtari | character varying | hayır |  |
| kullanilan | bigint | hayır | 0 |

### user_limits

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('user_limits_id_seq'::regclass) |
| kullanici_id | bigint | evet |  |
| limit_tipi | character varying | hayır |  |
| limit_degeri | bigint | hayır |  |

### user_system_roles

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('user_system_roles_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| rol_id | integer | hayır |  |
| atayan_id | bigint | evet |  |
| atama_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| bitis_tarihi | timestamp with time zone | evet |  |
| aktif | boolean | hayır | true |

### vip_seviyeleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | integer | hayır | nextval('vip_seviyeleri_id_seq'::regclass) |
| ad | character varying | hayır |  |
| fiyat_elmas | bigint | hayır |  |
| sure_gun | integer | hayır |  |
| ayricaliklar | jsonb | evet |  |
| aktif | boolean | hayır | true |

### wallet_ledger

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır |  |
| kullanici_id | bigint | evet |  |
| sistem_kodu | character varying | evet |  |
| varlik | USER-DEFINED | hayır |  |
| yon | USER-DEFINED | hayır |  |
| kaynak | USER-DEFINED | evet |  |
| islem | USER-DEFINED | hayır |  |
| miktar | bigint | hayır |  |
| bakiye_sonrasi | bigint | hayır |  |
| lot_id | bigint | evet |  |
| para_birimi | character varying | evet |  |
| referans_tip | character varying | evet |  |
| referans_id | bigint | evet |  |
| idempotency_key | character varying | evet |  |
| aciklama | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | hayır | CURRENT_TIMESTAMP |

### wallet_ledger_2026_06

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır |  |
| kullanici_id | bigint | evet |  |
| sistem_kodu | character varying | evet |  |
| varlik | USER-DEFINED | hayır |  |
| yon | USER-DEFINED | hayır |  |
| kaynak | USER-DEFINED | evet |  |
| islem | USER-DEFINED | hayır |  |
| miktar | bigint | hayır |  |
| bakiye_sonrasi | bigint | hayır |  |
| lot_id | bigint | evet |  |
| para_birimi | character varying | evet |  |
| referans_tip | character varying | evet |  |
| referans_id | bigint | evet |  |
| idempotency_key | character varying | evet |  |
| aciklama | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | hayır | CURRENT_TIMESTAMP |

### wallet_ledger_2026_07

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır |  |
| kullanici_id | bigint | evet |  |
| sistem_kodu | character varying | evet |  |
| varlik | USER-DEFINED | hayır |  |
| yon | USER-DEFINED | hayır |  |
| kaynak | USER-DEFINED | evet |  |
| islem | USER-DEFINED | hayır |  |
| miktar | bigint | hayır |  |
| bakiye_sonrasi | bigint | hayır |  |
| lot_id | bigint | evet |  |
| para_birimi | character varying | evet |  |
| referans_tip | character varying | evet |  |
| referans_id | bigint | evet |  |
| idempotency_key | character varying | evet |  |
| aciklama | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | hayır | CURRENT_TIMESTAMP |

### wallet_ledger_2026_08

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır |  |
| kullanici_id | bigint | evet |  |
| sistem_kodu | character varying | evet |  |
| varlik | USER-DEFINED | hayır |  |
| yon | USER-DEFINED | hayır |  |
| kaynak | USER-DEFINED | evet |  |
| islem | USER-DEFINED | hayır |  |
| miktar | bigint | hayır |  |
| bakiye_sonrasi | bigint | hayır |  |
| lot_id | bigint | evet |  |
| para_birimi | character varying | evet |  |
| referans_tip | character varying | evet |  |
| referans_id | bigint | evet |  |
| idempotency_key | character varying | evet |  |
| aciklama | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | hayır | CURRENT_TIMESTAMP |

### wallet_ledger_default

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır |  |
| kullanici_id | bigint | evet |  |
| sistem_kodu | character varying | evet |  |
| varlik | USER-DEFINED | hayır |  |
| yon | USER-DEFINED | hayır |  |
| kaynak | USER-DEFINED | evet |  |
| islem | USER-DEFINED | hayır |  |
| miktar | bigint | hayır |  |
| bakiye_sonrasi | bigint | hayır |  |
| lot_id | bigint | evet |  |
| para_birimi | character varying | evet |  |
| referans_tip | character varying | evet |  |
| referans_id | bigint | evet |  |
| idempotency_key | character varying | evet |  |
| aciklama | text | evet |  |
| olusturulma_tarihi | timestamp with time zone | hayır | CURRENT_TIMESTAMP |

### withdrawal_requests

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('withdrawal_requests_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| tutar | bigint | hayır |  |
| para_birimi | character varying | hayır |  |
| yontem | character varying | evet |  |
| hesap_bilgisi_sifreli | bytea | evet |  |
| durum | USER-DEFINED | hayır | 'beklemede'::cekim_durumu |
| inceleyen_id | bigint | evet |  |
| red_sebebi | text | evet |  |
| idempotency_key | character varying | evet |  |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| onay_tarihi | timestamp with time zone | evet |  |
| odeme_tarihi | timestamp with time zone | evet |  |

### xp_gunluk

| sütun | tip | null | varsayılan |
|---|---|---|---|
| kullanici_id | bigint | hayır |  |
| gun | date | hayır | CURRENT_DATE |
| kaynak | text | hayır |  |
| miktar | integer | hayır | 0 |

### yaptirimlar

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('yaptirimlar_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| kapsam | USER-DEFINED | hayır |  |
| oda_id | bigint | evet |  |
| tip | USER-DEFINED | hayır |  |
| sebep | text | evet |  |
| uygulayan_id | bigint | evet |  |
| baslangic_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| bitis_tarihi | timestamp with time zone | evet |  |
| aktif | boolean | hayır | true |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |

### yayinci_odemeleri

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('yayinci_odemeleri_id_seq'::regclass) |
| kullanici_id | bigint | hayır |  |
| ajans_id | integer | evet |  |
| donem_baslangic | date | hayır |  |
| donem_bitis | date | hayır |  |
| kota_miktari | bigint | hayır |  |
| kazanc_kuru | numeric | hayır |  |
| para_birimi | character varying | hayır |  |
| brut_tutar | bigint | hayır |  |
| ajans_komisyonu | bigint | hayır | 0 |
| net_tutar | bigint | hayır |  |
| durum | USER-DEFINED | hayır | 'beklemede'::odeme_durumu |
| olusturulma_tarihi | timestamp with time zone | evet | CURRENT_TIMESTAMP |
| odeme_tarihi | timestamp with time zone | evet |  |

### yonetici_islem_log

| sütun | tip | null | varsayılan |
|---|---|---|---|
| id | bigint | hayır | nextval('yonetici_islem_log_id_seq'::regclass) |
| yapan_id | bigint | evet |  |
| hedef_tip | text | hayır |  |
| hedef_id | bigint | hayır |  |
| islem | text | hayır |  |
| detay | text | evet |  |
| tarih | timestamp with time zone | hayır | now() |

## Enum tipleri

> 30 Ağustos 2026'da canlı veritabanından okundu. Dökümdeki sütunlarda
> "USER-DEFINED" yazan her tip burada. **Etiket tahmin etme** — 062'de
> `magaza_satin_alma` yerine `satin_alma` yazdığımız için mağaza kırılmıştı.

| tip | etiketler |
|---|---|
| `varlik_tipi` | elmas, altin, kazanc, fiat |
| `bakiye_kaynagi` | earned, purchased, campaign, admin_grant, bonus, gift, refund |
| `hareket_yonu` | giris, cikis |
| `islem_tipi` | hediye_gonderim, hediye_kazanc, elmas_satin_alma, elmas_transfer_gonderim, elmas_transfer_alim, elmas_altin_donusum, cuzdan_elmas_donusum, kota_donusum, kota_odeme, ajans_komisyonu, platform_geliri, magaza_satin_alma, vip_satin_alma, cekim, cekim_iade, admin_ekleme, kampanya_odulu, referans_odulu, iade, duzeltme |
| `gorev_tipi` | gunluk, haftalik, basarim |
| `esya_tipi` | cerceve, balon, giris_efekti, sohbet_baloncugu, arka_plan |
| `ekonomi_rolu` | standart, yayinci, bayi, user, developer, super_admin |
| `kullanici_durumu` | cevrimici, cevrimdisi, gizli, rahatsiz_etme |
| `kyc_durumu` | yok, beklemede, dogrulandi, reddedildi |
| `cekim_durumu` | beklemede, onaylandi, reddedildi, odendi |
| `odeme_durumu` | beklemede, onaylandi, odendi, iptal |
| `satin_alma_durumu` | beklemede, dogrulandi, reddedildi, iade |
| `transfer_durumu` | tamamlandi, iptal |
| `oda_rolu` | sahip, yonetici, moderator, uye |
| `ajans_rolu` | yonetici, yayinci |
| `bildirim_tipi` | takip, dm, hediye, oda_davet, odeme, sistem, begeni, yorum, etkinlik, arkadaslik, gorev |
| `arkadaslik_durumu` | beklemede, kabul, reddedildi |
| `gonderi_kapsami` | herkes, arkadaslar, takipciler |
| `rapor_durumu` | acik, inceleniyor, islem_yapildi, kapatildi |
| `etkinlik_durumu` | taslak, yakinda, yayinda, bitti, iptal |
| `ozel_id_durumu` | musait, rezerve, satildi |
| `ozel_id_tier` | normal, super, altin, elmas, kral |
| `outbox_durumu` | beklemede, gonderildi, basarisiz |

**Ekonomi okuması:** satın alınan altın `purchased`, hediyeden gelen kazanç
`earned`, görev/kampanya ödülü `campaign` kovasına yazılır. `campaign`
promo tarafına düşer: hediyeye harcanır ama çekilemez.


## Fonksiyonlar (RPC)

- `_bakiye_uygula(p_kul bigint, p_varlik text, p_delta bigint, p_sebep text, p_yapan bigint)` → void
- `_yonetici_log(p_tip text, p_id bigint, p_islem text, p_detay text DEFAULT NULL::text)` → void
- `admin_bakiye_ekle(p_hedef_id bigint, p_varlik varlik_tipi, p_miktar bigint, p_sebep text)` → bigint
- `admin_email_degistir(p_hedef bigint, p_yeni text)` → void
- `admin_gonderi_sil(p_gonderi_id bigint)` → boolean
- `admin_hak_ata(p_hedef bigint, p_alan text, p_deger boolean)` → void
- `admin_islem_gecmisi(p_tip text, p_id bigint, p_limit integer DEFAULT 100)` → TABLE(id bigint, islem text, detay text, tarih timestamp with time zone, yapan_id bigint, yapan_ad text, yapan_public_id text, yapan_rol text)
- `admin_kullanici_getir(p_hedef bigint)` → TABLE(id bigint, public_id text, kullanici_adi text, profil_resmi text, email text, rol text, seviye_id integer, deneyim_puani bigint, elmas bigint, altin bigint, elmas_dondu boolean, altin_dondu boolean, mic_yasakli boolean, mic_sebep text, mic_bitis timestamp with time zone, hesap_yasakli boolean, hesap_sebep text, hesap_bitis timestamp with time zone, rapor_sayisi bigint, kayit_tarihi timestamp with time zone)
- `admin_kullanici_guncelle(p_hedef bigint, p_ad text DEFAULT NULL::text, p_avatar text DEFAULT NULL::text)` → void
- `admin_kullanici_haklar(p_hedef bigint)` → TABLE(beta_tester boolean, premium_hak boolean, ozel_id text, ozel_id_tip text)
- `admin_oda_getir(p_oda bigint)` → TABLE(id bigint, public_id text, ad text, aciklama text, kategori text, kapak_url text, herkese_acik boolean, olusturan_id bigint, sahip_ad text, sahip_public_id text, uye_sayisi bigint, aktif_katilimci integer, islem_gordu boolean, islem_sebep text, islem_tarihi timestamp with time zone)
- `admin_oda_guncelle(p_oda bigint, p_ad text, p_aciklama text)` → void
- `admin_oda_islem_isaretle(p_oda bigint, p_isaretli boolean, p_sebep text DEFAULT NULL::text)` → void
- `admin_oda_public_id_degistir(p_oda bigint, p_yeni text)` → void
- `admin_public_id_degistir(p_hedef bigint, p_yeni text)` → void
- `admin_sifre_sifirla(p_hedef bigint, p_yeni text)` → void
- `admin_varlik_dondur(p_hedef bigint, p_varlik text, p_dondur boolean)` → void
- `aktif_admin_id()` → bigint
- `ayar_numeric(p_anahtar character varying, p_varsayilan numeric)` → numeric
- `bakiye_ekle(p_hedef bigint, p_varlik text, p_miktar bigint, p_sebep text DEFAULT NULL::text)` → void
- `bakiye_transfer(p_hedef bigint, p_varlik text, p_miktar bigint)` → void
- `banner_ekle(p_baslik text, p_aciklama text DEFAULT NULL::text, p_foto text DEFAULT NULL::text, p_sira integer DEFAULT 0, p_sablon te)` → bigint
- `banner_guncelle(p_id bigint, p_baslik text, p_aciklama text, p_foto text, p_sira integer, p_sablon text DEFAULT NULL::text, p_icerik jso)` → void
- `banner_sil(p_id bigint)` → void
- `ben_developer()` → boolean
- `ben_platform_yoneticisi()` → boolean
- `benim_bakiyem()` → TABLE(elmas bigint, altin bigint)
- `benim_hesap_yasagim()` → TABLE(sebep text, bitis timestamp with time zone, kalici boolean)
- `benim_kullanici_id()` → bigint
- `benim_mic_yasagim()` → TABLE(sebep text, bitis timestamp with time zone, kalici boolean)
- `beta_kapsul_hatirlat()` → void
- `bildirim_begeni()` → trigger
- `bildirim_dm()` → trigger
- `bildirim_takip()` → trigger
- `bildirim_yorum()` → trigger
- `cache_artir(p_kullanici_id bigint, p_varlik varlik_tipi, p_kaynak bakiye_kaynagi, p_delta bigint)` → void
- `cache_onar(p_kullanici_id bigint)` → void
- `cekim_durum_fn()` → trigger
- `cekim_reddet(p_cekim_id bigint, p_inceleyen_id bigint, p_sebep text)` → void
- `cekim_talep_olustur(p_kullanici_id bigint, p_tutar bigint, p_para character varying, p_yontem character varying, p_hesap_sifreli bytea, p_id)` → bigint
- `cuzdan_ekle(p_kullanici_id bigint, p_para character varying, p_tutar bigint)` → bigint
- `cuzdan_elmas_donustur(p_kullanici_id bigint, p_para character varying, p_tutar bigint, p_idem character varying DEFAULT NULL::character varyin)` → bigint
- `dm_konusma_bul_olustur(p_diger_id bigint)` → bigint
- `dm_mesaj_dogrula_fn()` → trigger
- `dm_okundu(p_konusma_id bigint)` → void
- `dm_son_mesaj_guncelle()` → trigger
- `elmas_altin_donustur(p_kullanici_id bigint, p_elmas bigint, p_idem character varying DEFAULT NULL::character varying)` → bigint
- `elmas_transfer_fn()` → trigger
- `engel_sonrasi_takip_kopar()` → trigger
- `esya_cikar(p_esya_id text)` → void
- `esya_kusan(p_esya_id text)` → void
- `esya_satin_al(p_esya_id text)` → TABLE(elmas bigint, altin bigint)
- `feature_aktif(p_anahtar character varying)` → boolean
- `gonderi_begeni_say()` → trigger
- `gonderi_sil(p_gonderi_id bigint)` → boolean
- `gonderi_yorum_say()` → trigger
- `handle_new_auth_user()` → trigger
- `hediye_after_fn()` → trigger
- `hediye_gonder(p_hediye_id text, p_adet integer, p_alici_id bigint, p_oda_id bigint DEFAULT NULL::bigint)` → TABLE(elmas bigint, altin bigint, kazanc bigint, komisyon bigint)
- `hediye_gonder_fn()` → trigger
- `hesabimi_sil()` → void
- `hesap_yasak_kaldir(p_hedef bigint)` → void
- `hesap_yasak_ver(p_hedef bigint, p_sebep text DEFAULT NULL::text, p_dakika integer DEFAULT NULL::integer)` → void
- `idem_kaydet(p_anahtar character varying, p_kapsam character varying, p_kullanici bigint)` → void
- `kazanc_gunluk(p_gun integer DEFAULT 7)` → TABLE(gun date, altin bigint, hediye bigint)
- `kazanc_hareket(p_kullanici_id bigint, p_islem islem_tipi, p_delta bigint, p_ref_tip character varying, p_ref_id bigint)` → void
- `kazanc_ozeti()` → TABLE(bugun bigint, bu_ay bigint, toplam bigint, komisyon bigint, hediye_ay bigint, kisi_ay bigint)
- `kazanc_saatlik(p_gun_once integer DEFAULT 0)` → TABLE(saat integer, altin bigint, hediye bigint)
- `kisiye_mesaj_gonder(p_hedef bigint, p_kanal text, p_baslik text, p_icerik text, p_tur text DEFAULT 'mesaj'::text, p_foto text DEFAULT NULL::)` → bigint
- `kullanici_adi_musait(p_ad text)` → boolean
- `kullanici_hassas_log_fn()` → trigger
- `kullanici_kilitle(VARIADIC p_ids bigint[])` → void
- `kullanici_rozetleri_getir(p_kullanici bigint)` → TABLE(kod text, ad text, aciklama text, kategori text, kazanma_tarihi timestamp with time zone)
- `kullanici_seviye_guncelle(p_kullanici_id bigint)` → void
- `kur_getir(p_para character varying, OUT o_elmas numeric, OUT o_kazanc numeric)` → record
- `ledger_partisyon_olustur(p_ay date)` → void
- `limit_tuket(p_kullanici_id bigint, p_tip character varying, p_donem character varying, p_miktar bigint)` → void
- `lot_arsivle(p_gun integer DEFAULT 90)` → integer
- `lot_harca(p_kullanici_id bigint, p_varlik varlik_tipi, p_miktar bigint, p_islem islem_tipi, p_ref_tip character varying DEFAULT NU)` → bigint
- `lot_yatir(p_kullanici_id bigint, p_varlik varlik_tipi, p_kaynak bakiye_kaynagi, p_miktar bigint, p_islem islem_tipi, p_ref_tip cha)` → bigint
- `mic_yasak_kaldir(p_hedef bigint)` → void
- `mic_yasak_ver(p_hedef bigint, p_sebep text DEFAULT NULL::text, p_dakika integer DEFAULT NULL::integer)` → void
- `oda_katilim_fn()` → trigger
- `oda_katilimci_yaz(p_oda_id bigint, p_sayi integer)` → void
- `oda_koltuk_olustur_fn()` → trigger
- `oda_mesaj_yaptirim_fn()` → trigger
- `oda_parola_belirle(p_oda bigint, p_parola text)` → void
- `oda_parola_dogrula(p_oda bigint, p_parola text)` → boolean
- `oda_rol_ata(p_oda_id bigint, p_hedef bigint, p_rol text)` → void
- `oda_sahibi_ekle()` → trigger
- `oda_seviye_guncelle(p_oda_id bigint)` → void
- `oda_stale_katilimcilari_temizle(p_esik_dakika integer DEFAULT 5)` → integer
- `oda_uye_cikar(p_oda_id bigint, p_hedef bigint)` → void
- `oda_vitrin_ayarla(p_oda_id bigint, p_resmi boolean DEFAULT NULL::boolean, p_gunluk_sira smallint DEFAULT NULL::smallint, p_sirayi_temizle )` → void
- `oda_yasak_kaldir(p_oda_id bigint, p_hedef bigint)` → void
- `oda_yasakla(p_oda_id bigint, p_hedef bigint)` → void
- `oda_ziyaret_kaydet(p_oda_id bigint)` → void
- `odaya_mesaj_gonder(p_oda bigint, p_baslik text, p_icerik text, p_tur text DEFAULT 'mesaj'::text, p_bildirim boolean DEFAULT true)` → bigint
- `ozel_id_ayarla(p_id text, p_tip text, p_tema text)` → void
- `ozel_id_kaldir()` → void
- `pii_coz(p_sifreli bytea, p_anahtar text)` → text
- `pii_sifrele(p_acik text, p_anahtar text)` → bytea
- `platform_rol_ata(p_hedef bigint, p_rol text)` → void
- `profilimi_garantile()` → void
- `reconcile_kullanici(p_kullanici_id bigint)` → bigint
- `risk_event_isle_fn()` → trigger
- `rol_degisiklik_log_fn()` → trigger
- `room_stat_birlestir()` → integer
- `rozet_al(p_hedef bigint, p_kod text)` → void
- `rozet_ilerlemem()` → TABLE(kod text, ad text, aciklama text, kategori text, kazanildi boolean, kural_metrik text, kural_esik integer, ilerleme bigint)
- `rozet_kusan(p_kod text)` → void
- `rozet_kusanma_kaldir()` → void
- `rozet_metrikleri(p_kullanici bigint)` → TABLE(metrik text, deger bigint)
- `rozet_ver(p_hedef bigint, p_kod text)` → void
- `rozetleri_degerlendir(p_kullanici bigint DEFAULT NULL::bigint)` → integer
- `satin_alma_dogrula_fn()` → trigger
- `sema_dokumu()` → TABLE(tablo text, sutun text, tip text, bos_olabilir text, varsayilan text)
- `sema_fonksiyonlar()` → TABLE(ad text, donen text, argumanlar text)
- `set_guncellenme_tarihi()` → trigger
- `sistem_duyuru_gonder(p_kanal text, p_baslik text, p_icerik text, p_foto text DEFAULT NULL::text, p_bildirim boolean DEFAULT true)` → bigint
- `sistem_hesap_hareket(p_kod character varying, p_islem islem_tipi, p_miktar bigint, p_ref_tip character varying, p_ref_id bigint)` → void
- `son_hediyelerim(p_limit integer DEFAULT 20)` → TABLE(id bigint, gonderen text, gonderen_pid text, hediye_ad text, emoji text, adet integer, kazanc bigint, tarih timestamp with time zone)
- `xp_ekle(p_kaynak text)` → integer
- `yaptirim_ban_senkron_fn()` → trigger
- `yaptirim_var(p_kullanici_id bigint, p_tip yaptirim_tipi, p_oda_id bigint DEFAULT NULL::bigint)` → boolean
- `yayinci_odeme_donemi_olustur(IN p_donem_baslangic date, IN p_donem_bitis date, IN p_batch integer DEFAULT 200)` → 
- `yayinci_odeme_tamamla(p_odeme_id bigint)` → void
- `yeni_public_id()` → text
- `yorum_sil(p_yorum_id bigint)` → boolean
- `ziyaret_kaydet(p_edilen bigint)` → void
- `ziyaret_sayisi(p_kullanici bigint)` → integer
