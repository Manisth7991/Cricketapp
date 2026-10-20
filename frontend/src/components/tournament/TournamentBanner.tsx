import { Img } from '@/components/ui/Img';
import { sportTheme } from '@/utils/sportTheme';
import { cn } from '@/utils/cn';

/** Banner with a lightweight sport-themed fallback (pure CSS — no image request). */
export function TournamentBanner({
  src,
  sport,
  sportIcon,
  alt,
  sizes,
  priority,
  aspect = 16 / 9,
  className,
}: {
  src?: string;
  sport: string;
  sportIcon?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  aspect?: number;
  className?: string;
}) {
  const theme = sportTheme(sport, sportIcon);
  const fallback = (
    <div
      className={cn(
        'absolute inset-0 bg-gradient-to-br [container-type:inline-size]',
        theme.gradient,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(255_255_255/0.22),transparent_50%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.05)_0_24px,transparent_24px_48px)]" />
      <span
        className="absolute right-[3cqw] -bottom-[4cqw] text-[26cqw] leading-none opacity-30 select-none"
        aria-hidden
      >
        {theme.emoji}
      </span>
    </div>
  );
  return (
    <Img
      src={src}
      alt={alt}
      aspect={aspect}
      sizes={sizes}
      priority={priority}
      className={className}
      fallback={fallback}
    />
  );
}
