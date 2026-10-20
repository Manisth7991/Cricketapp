import { useState, type InputHTMLAttributes, type Ref } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';

export function PasswordInput(
  props: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> },
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-faint hover:text-ink"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}
