import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { uploadService, validateImage, type UploadKind } from '@/services/uploadService';
import { errorMessage } from './States';
import { imageUrl } from '@/utils/image';
import { cn } from '@/utils/cn';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  kind: UploadKind;
  label: string;
  aspect?: number;
  hint?: string;
  shape?: 'wide' | 'square';
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  kind,
  label,
  aspect = 16 / 9,
  hint,
  shape = 'wide',
  className,
}: ImageUploadProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) return setError(problem);
    setError(null);
    setProgress(0);
    try {
      onChange(await uploadService.image(file, kind, setProgress));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const uploading = progress !== null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-medium text-ink" id={`${id}-label`}>
        {label}
      </span>
      <div
        className={cn(
          'group relative overflow-hidden rounded-2xl border-2 border-dashed bg-white transition-colors',
          error ? 'border-red-300' : 'border-line hover:border-primary-400',
          shape === 'square' ? 'size-28' : 'w-full',
        )}
        style={shape === 'wide' ? { aspectRatio: aspect } : undefined}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handle(e.dataTransfer.files[0]);
        }}
      >
        {value && (
          <img
            src={imageUrl(value, 800)}
            alt=""
            className="absolute inset-0 size-full object-cover"
            decoding="async"
          />
        )}
        <label
          htmlFor={id}
          className={cn(
            'absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1.5 p-3 text-center text-sm transition-colors',
            value
              ? 'bg-ink/0 text-transparent hover:bg-ink/45 hover:text-white focus-within:bg-ink/45 focus-within:text-white'
              : 'text-ink-soft',
            uploading && 'bg-white/80 text-ink',
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-6 animate-spin text-primary-600" aria-hidden />
              <span className="font-medium tabular">Uploading {progress}%</span>
            </>
          ) : (
            <>
              <ImagePlus className="size-6" aria-hidden />
              <span className="font-medium">
                {value ? 'Change image' : shape === 'square' ? 'Add' : 'Click or drop an image'}
              </span>
              {shape === 'wide' && !value && (
                <span className="text-xs text-ink-faint">JPG, PNG or WebP · max 2 MB</span>
              )}
            </>
          )}
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-labelledby={`${id}-label`}
            disabled={uploading}
            onChange={(e) => void handle(e.target.files?.[0])}
          />
        </label>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-white/90 text-red-600 shadow hover:bg-white"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-soft">{hint}</p>
      )}
    </div>
  );
}
