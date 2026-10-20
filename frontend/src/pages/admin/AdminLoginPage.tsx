import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router';
import { Shield } from 'lucide-react';
import { loginSchema } from '@playlocal/shared';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { LogoMark } from '@/components/layout/Logo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function AdminLoginPage() {
  useDocumentTitle('Admin login');
  const { adminLogin, user } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  if (user?.role === 'admin') return <Navigate to="/admin" replace />;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await adminLogin(values);
      navigate('/admin', { replace: true });
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center text-white">
          <LogoMark className="size-12" />
          <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold">
            <Shield className="size-5 text-primary-400" aria-hidden /> PlayLocal Admin
          </h1>
          <p className="mt-1 text-sm text-slate-400">Authorised staff only</p>
        </div>
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[var(--shadow-lift)]"
        >
          {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
          <Field label="Email or phone" error={errors.identifier?.message} required>
            <Input autoComplete="username" autoFocus {...register('identifier')} />
          </Field>
          <Field label="Password" error={errors.password?.message} required>
            <PasswordInput autoComplete="current-password" {...register('password')} />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
