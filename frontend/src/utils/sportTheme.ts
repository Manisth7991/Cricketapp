/** Visual identity per sport for banner fallbacks (literal classes so Tailwind can see them). */
const THEMES: Record<string, { gradient: string; emoji: string }> = {
  cricket: { gradient: 'from-emerald-600 via-green-700 to-teal-800', emoji: '🏏' },
  football: { gradient: 'from-sky-600 via-blue-700 to-indigo-800', emoji: '⚽' },
  kabaddi: { gradient: 'from-orange-500 via-red-600 to-rose-700', emoji: '🤼' },
  volleyball: { gradient: 'from-amber-500 via-orange-600 to-red-600', emoji: '🏐' },
  badminton: { gradient: 'from-lime-500 via-emerald-600 to-teal-700', emoji: '🏸' },
  hockey: { gradient: 'from-cyan-600 via-sky-700 to-blue-800', emoji: '🏑' },
  basketball: { gradient: 'from-orange-600 via-amber-700 to-stone-800', emoji: '🏀' },
  'kho-kho': { gradient: 'from-fuchsia-600 via-purple-700 to-indigo-800', emoji: '🏃' },
  'table-tennis': { gradient: 'from-rose-500 via-pink-600 to-purple-700', emoji: '🏓' },
};

const FALLBACK = { gradient: 'from-slate-600 via-slate-700 to-slate-800', emoji: '🏆' };

export function sportTheme(slug: string, icon?: string) {
  const t = THEMES[slug] ?? FALLBACK;
  return { gradient: t.gradient, emoji: icon || t.emoji };
}
