import { useNavigation } from 'react-router';

/** Thin top progress bar while a lazy route chunk / navigation is loading. */
export function NavigationProgress() {
  const nav = useNavigation();
  if (nav.state === 'idle') return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-primary-100"
      role="progressbar"
      aria-label="Loading page"
    >
      <div className="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] bg-primary-600" />
      <style>
        {'@keyframes nav-progress{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}
      </style>
    </div>
  );
}
