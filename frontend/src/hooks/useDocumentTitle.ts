import { useEffect } from 'react';
import { config } from '@/lib/config';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title
      ? `${title} · ${config.appName}`
      : `${config.appName} — Local sports tournaments near you`;
  }, [title]);
}
