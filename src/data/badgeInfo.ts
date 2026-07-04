import { type PngBadgeName } from "@/components/PngBadge";

// Rozet bilgi kartı içeriği — başlıklar İngilizce (kullanıcı tercihi),
// açıklamalar Türkçe. Rozete tıklanınca liquid-glass modalda gösterilir.
export type BadgeInfo = { title: string; sub: string; desc: string; tint: string };

export const BADGE_INFO: Record<PngBadgeName, BadgeInfo> = {
  level_bronze: { title: "Bronze", sub: "Seviye Rütbesi", desc: "İlk adımlar. 1–9 seviye aralığındaki üyelerin taşıdığı bronz rütbe.", tint: "#C77B3B" },
  level_silver: { title: "Silver", sub: "Seviye Rütbesi", desc: "Gümüş rütbe. 10–19 seviye aralığına ulaşan aktif üyeler.", tint: "#C7CBD1" },
  level_gold: { title: "Gold", sub: "Seviye Rütbesi", desc: "Altın rütbe. 20–29 seviye aralığındaki köklü üyeler.", tint: "#F5B100" },
  level_platinum: { title: "Platinum", sub: "Seviye Rütbesi", desc: "Platin rütbe. 30–39 seviye — topluluğun kıdemli üyeleri.", tint: "#8FE3E8" },
  level_diamond: { title: "Diamond", sub: "Seviye Rütbesi", desc: "Elmas rütbe. 40–49 seviye — en aktif elit üyeler.", tint: "#5AA9FF" },
  level_legendary: { title: "Legendary", sub: "Seviye Rütbesi", desc: "Efsanevi rütbe. 50+ seviye — platformun zirvesindeki isimler.", tint: "#B98CFF" },
  role_developer: { title: "Developer", sub: "Sistem Rolü", desc: "Aron Chat geliştirici ekibi. En yüksek yetki seviyesi.", tint: "#A98CFF" },
  role_super_admin: { title: "Super Admin", sub: "Yönetim Rolü", desc: "Platform genelinde tam yetkili baş yönetici.", tint: "#FF6B6B" },
  role_admin: { title: "Admin", sub: "Yönetim Rolü", desc: "Platform yöneticisi. Kullanıcı ve oda denetiminden sorumlu.", tint: "#F5B100" },
  role_moderator: { title: "Moderator", sub: "Yönetim Rolü", desc: "Topluluk moderatörü. Kuralların uygulanmasını sağlar.", tint: "#B0A0FF" },
  role_streamer: { title: "Streamer", sub: "İçerik Rolü", desc: "Onaylı yayıncı. Sesli odalarda düzenli yayın açan üyeler.", tint: "#4ADE80" },
  role_vip: { title: "VIP", sub: "Ayrıcalık Rozeti", desc: "VIP üyelik. Özel ayrıcalıklara ve önceliğe sahip üyeler.", tint: "#E5484D" },
  role_vip_hukumdar: { title: "VIP Sovereign", sub: "Ayrıcalık Rozeti", desc: "En üst düzey VIP. Hükümdar seviyesinde ayrıcalıklar.", tint: "#C9A227" },
  room_weekly_champion: { title: "Weekly Champion", sub: "Oda Başarısı", desc: "Haftanın şampiyonu olan oda. Haftalık zirvenin sahibi.", tint: "#F5B100" },
  room_rank_silver: { title: "Silver Rank", sub: "Oda Sıralaması", desc: "Sıralamada gümüş basamağa ulaşan oda.", tint: "#C7CBD1" },
  room_rank_bronze: { title: "Bronze Rank", sub: "Oda Sıralaması", desc: "Sıralamada bronz basamağa ulaşan oda.", tint: "#C77B3B" },
  room_rising_star: { title: "Rising Star", sub: "Oda Başarısı", desc: "Yükselen yıldız. Hızla büyüyen yeni oda.", tint: "#5AA9FF" },
  room_top_gifter: { title: "Top Gifter", sub: "Oda Başarısı", desc: "En çok hediye alan/gönderen oda topluluğu.", tint: "#8FE3E8" },
  room_daily_streak: { title: "Daily Streak", sub: "Oda Başarısı", desc: "Günlük seri. Kesintisiz aktif kalan oda.", tint: "#FF7A45" },
  special_beta_tester: { title: "Beta Tester", sub: "Özel Rozet", desc: "Beta test sürecine katkı sağlayan erken üyeler. Nadir rozet.", tint: "#38BDF8" },
};
