import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { Field } from './Field';
import { Textarea } from './Input';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  /** Ask for a reason (e.g. reject/suspend). */
  reason?: { label: string; required?: boolean; minLength?: number; placeholder?: string };
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  loading,
  reason,
}: ConfirmDialogProps) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const min = reason?.minLength ?? (reason?.required ? 5 : 0);
  const invalid = Boolean(reason?.required) && text.trim().length < min;

  const close = () => {
    setText('');
    setTouched(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(text.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {reason && (
        <Field
          label={reason.label}
          required={reason.required}
          error={touched && invalid ? `Please enter at least ${min} characters` : undefined}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={reason.placeholder}
            maxLength={500}
          />
        </Field>
      )}
    </Modal>
  );
}
