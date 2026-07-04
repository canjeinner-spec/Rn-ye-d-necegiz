import { type BadgeType } from "@/components/Badge";
import { type PngBadgeName } from "@/components/PngBadge";

export type BadgeKind = BadgeType | "agency";

/** Kullanıcı seviyesine göre premium seviye rozeti (level/*.png) seçer. */
export function levelTierBadge(level: number): PngBadgeName {
  if (level >= 50) return "level_legendary";
  if (level >= 40) return "level_diamond";
  if (level >= 30) return "level_platinum";
  if (level >= 20) return "level_gold";
  if (level >= 10) return "level_silver";
  return "level_bronze";
}

export type BadgeItem = {
  type: BadgeKind;
  lvl?: number | string;
  meta?: { id?: string; name?: string; owner?: string };
};

export const BADGE_INFO: Record<string, { label: string; icon: string; desc: string }> = {
  developer: { label: "Developer", icon: "developer", desc: "Aron'u geliştiren ekibe verilir. Uygulamanın kodunu yazan ve sistemi ayakta tutan kişilerdir." },
  vip: { label: "VIP", icon: "vip", desc: "VIP üyeliği satın alan kullanıcılara verilir. Özel çerçeveler, giriş efektleri ve ayrıcalıklar sağlar." },
  level: { label: "Seviye", icon: "level", desc: "Aktiflik ve harcamaya göre yükselen seviye rozetidir. Seviyen arttıkça yeni ödüllerin kilidi açılır." },
  streamer: { label: "Yayıncı", icon: "streamer", desc: "Onaylı yayıncılara verilir. Düzenli yayın açan ve ajansa bağlı içerik üreticilerini gösterir." },
  member: { label: "Üye", icon: "member", desc: "Topluluğun kayıtlı üyelerine verilir. Aktif kaldıkça rozetin parlak kalır." },
  super_admin: { label: "Super Admin", icon: "super_admin", desc: "Platform yöneticilerine verilir. En yüksek yetki seviyesine sahiptir." },
  agency: { label: "Ajans", icon: "agency", desc: "Bir ajansa bağlı üyelere verilir. Ajans, yayıncılarını yöneten ve destekleyen resmi ekiptir." },
};
