-- ============================================================================
-- 004_storage_avatars.sql — Profil fotoğrafı için Supabase Storage
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: Supabase SQL Editor (sıra önemli değil, bağımsız).
--
-- Ne yapar:
--   • "avatars" public bucket (okuma herkese açık, 5MB, sadece görsel)
--   • Yükleme/güncelleme/silme yalnızca kullanıcının KENDİ klasöründe
--     (dosya yolu: <auth_uid>/<...>) → başkasının fotosunu değiştiremez
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars', 'avatars', TRUE, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Herkese açık okuma
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'avatars');

-- Kendi klasörüne yükleme (ilk klasör adı = auth.uid())
DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Kendi dosyalarını güncelle
DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Kendi dosyalarını sil
DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
