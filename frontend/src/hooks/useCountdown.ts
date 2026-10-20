import { useEffect, useState } from 'react';

/** Live countdown in seconds, e.g. for "Resend code in 0:24". */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);
  return [seconds, setSeconds] as const;
}
