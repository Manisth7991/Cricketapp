/**
 * Responsive image helper. For Cloudinary URLs it injects on-the-fly transforms
 * (auto format → AVIF/WebP, auto quality, exact width) so the browser never
 * downloads more pixels than it renders. Other URLs pass through unchanged.
 */
const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;

export function imageUrl(
  src: string | undefined,
  width: number,
  opts: { height?: number; crop?: 'fill' | 'limit' } = {},
) {
  if (!src) return undefined;
  const m = CLOUDINARY.exec(src);
  if (!m) return src;
  const parts = ['f_auto', 'q_auto', `w_${width}`, `c_${opts.crop ?? 'limit'}`];
  if (opts.height) parts.push(`h_${opts.height}`, 'g_auto');
  return `${m[1]}${parts.join(',')}/${m[2]}`;
}

export function imageSrcSet(src: string | undefined, widths: number[], opts?: { aspect?: number }) {
  if (!src || !CLOUDINARY.test(src)) return undefined;
  return widths
    .map(
      (w) =>
        `${imageUrl(src, w, opts?.aspect ? { height: Math.round(w / opts.aspect), crop: 'fill' } : {})} ${w}w`,
    )
    .join(', ');
}
