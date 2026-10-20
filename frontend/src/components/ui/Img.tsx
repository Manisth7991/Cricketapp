import { useState, type ReactNode } from 'react';
import { imageSrcSet, imageUrl } from '@/utils/image';
import { cn } from '@/utils/cn';

interface ImgProps {
  src?: string;
  alt: string;
  /** width / height */
  aspect: number;
  sizes: string;
  widths?: number[];
  className?: string;
  priority?: boolean;
  fallback?: ReactNode;
}

/**
 * Performance-first image: reserves space via aspect-ratio (zero layout shift),
 * serves responsive Cloudinary variants, lazy-loads below the fold and fades in.
 */
export function Img({
  src,
  alt,
  aspect,
  sizes,
  widths = [320, 480, 640, 960, 1280],
  className,
  priority,
  fallback,
}: ImgProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const largest = widths[widths.length - 1]!;

  return (
    <div
      className={cn('relative overflow-hidden bg-slate-100', className)}
      style={{ aspectRatio: aspect }}
    >
      {src && !failed ? (
        <img
          src={imageUrl(src, largest, { height: Math.round(largest / aspect), crop: 'fill' })}
          srcSet={imageSrcSet(src, widths, { aspect })}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
