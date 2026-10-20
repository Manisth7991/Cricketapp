import { initials } from '@/utils/format';
import { imageUrl } from '@/utils/image';
import { cn } from '@/utils/cn';

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
};
const px = { sm: 64, md: 80, lg: 112, xl: 160 };

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  square,
}: {
  name: string;
  src?: string;
  size?: keyof typeof sizes;
  className?: string;
  square?: boolean;
}) {
  const shape = square ? 'rounded-xl' : 'rounded-full';
  if (src) {
    return (
      <img
        src={imageUrl(src, px[size], { height: px[size], crop: 'fill' })}
        alt=""
        width={px[size] / 2}
        height={px[size] / 2}
        loading="lazy"
        decoding="async"
        className={cn(sizes[size], shape, 'shrink-0 bg-slate-100 object-cover', className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        sizes[size],
        shape,
        'grid shrink-0 place-items-center bg-gradient-to-br from-primary-500 to-accent-600 font-semibold text-white',
        className,
      )}
    >
      {initials(name) || '?'}
    </span>
  );
}
