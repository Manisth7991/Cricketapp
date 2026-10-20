import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Native <dialog> modal: focus trapping, Esc-to-close and inert background come
 * from the platform — no JS focus-trap library needed. On mobile it docks as a sheet.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Several dialogs can be mounted on one page — each needs its own title id for aria-labelledby.
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      aria-labelledby={titleId}
      className={cn(
        'm-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-ink shadow-[var(--shadow-lift)] open:animate-[var(--animate-slide-up)]',
        'sm:m-auto sm:rounded-3xl',
        widths[size],
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          {/* Header carries its own bottom padding so the footer divider never touches the text. */}
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          {children && <div className="overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
