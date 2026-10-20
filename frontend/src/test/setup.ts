import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest doesn't enable globals here, so RTL's auto-cleanup must be wired manually.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom lacks <dialog> methods used by Modal.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}
window.scrollTo = () => undefined;
