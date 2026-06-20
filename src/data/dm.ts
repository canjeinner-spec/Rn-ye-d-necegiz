/**
 * DM verisi — dm_konusmalari / dm_mesajlari ile uyumlu.
 * Aron (resmi) ve Sistem özel hesaplardır (sistem_hesaplari / resmi yayın).
 */
export type DMThread = {
  id: number;
  name: string;
  official?: boolean;
  system?: boolean;
  last: string;
  time: string;
  unread: number;
  online: boolean;
};

export const DM_THREADS: DMThread[] = [
  { id: 1, name: "Aron", official: true, last: '"Samimi değilsen uzak ol!" etkinliği başlamak üzere', time: "Cuma 20:58", unread: 0, online: true },
  { id: 2, name: "Sistem", system: true, last: "Üye rozetin grileşti", time: "20/05 21:00", unread: 0, online: true },
  { id: 3, name: "Mervee", last: "Odaya gelsene, konuşalım biraz 🎀", time: "21:48", unread: 2, online: true },
  { id: 4, name: "Zeno Sv.", last: "Akşam yayın var mı?", time: "21:45", unread: 1, online: true },
  { id: 5, name: "Lunas", last: "Tamamdır, bekliyorum seni ✨", time: "21:43", unread: 0, online: true },
  { id: 6, name: "Ender", last: "Sesli odan çok keyifli yaa 🔥", time: "21:40", unread: 0, online: true },
  { id: 7, name: "Furkan", last: "Yarın birlikte yayın açalım mı?", time: "21:38", unread: 0, online: false },
  { id: 8, name: "Rüya", last: "İyi geceler, görüşürüz 💜", time: "21:35", unread: 0, online: false },
  { id: 9, name: "Melis", last: "Teşekkürler 🙏", time: "21:30", unread: 0, online: true },
];

export type AronPost = { date: string; text: string };
export type SystemPost = { date: string; icon: string; title: string; text: string };

export const ARON_POSTS: AronPost[] = [
  { date: "05/06 09:09", text: "Zafer korkusuz olanındır! \"Sultan'ın Tahtı\" onur savaşı başladı! Yüklenen her kademe için ödüller açılır, listelerin zirvesine tırman ve eşsiz şerefe sahip ol!" },
  { date: "Cuma 20:01", text: "【Futbol Şampiyonası】şimdi yayında!\nOda içinde bir futbol oyunu başlat ve arkadaşlarınla heyecan dolu bir maç yap~\nEtkinliğe katıl ve listede İLK 30 odadan biri ol; altınlar, sırt çantası hediyeleri ve sınırlı profil çerçeveleri dahil harika ödüller kazanma şansı yakala!" },
  { date: "Cuma 20:58", text: "\"Samimi değilsen uzak ol!\" etkinliği başlamak üzere.\nYüzünü göstermene gerek yok, sadece sesinin cazibesiyle onun kalbini kazan! Hemen odaya gir ve eğlenceye katıl!" },
];

export const SYSTEM_POSTS: SystemPost[] = [
  { date: "20/05 21:00", icon: "🏅", title: "Üye Rozeti", text: "30 gün giriş yapmadığın için üye rozetin grileşti. Tekrar aktif olmak için bir odaya katıl!" },
  { date: "18/05 14:22", icon: "⬆️", title: "Seviye Atladın", text: "Tebrikler! Seviye 12'ye ulaştın. Yeni bir profil çerçevesinin kilidini açtın." },
  { date: "15/05 09:10", icon: "🎁", title: "Günlük Ödül", text: "Günlük giriş ödülün hesabına eklendi: 100 altın." },
];
