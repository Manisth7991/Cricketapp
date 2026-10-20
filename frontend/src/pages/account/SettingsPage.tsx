import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { changePasswordSchema, updateProfileSchema } from '@playlocal/shared';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { authService } from '@/services/authService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { applyServerErrors } from '@/utils/forms';

const profileForm = updateProfileSchema.pick({ name: true, email: true, profileImage: true });
const passwordForm = changePasswordSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

function ProfileForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileForm),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      profileImage: user?.profileImage ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await authService.updateProfile(values);
      setUser(updated);
      reset({
        name: updated.name,
        email: updated.email ?? '',
        profileImage: updated.profileImage ?? '',
      });
      toast.success('Profile updated');
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="card flex flex-col gap-5 p-5 sm:p-6">
      <h2 className="text-lg font-bold">Profile</h2>
      {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
      <Controller
        control={control}
        name="profileImage"
        render={({ field }) => (
          <ImageUpload
            kind="avatar"
            label="Profile photo"
            shape="square"
            value={field.value}
            onChange={field.onChange}
            hint="Optional"
          />
        )}
      />
      <Field label="Full name" error={errors.name?.message} required>
        <Input autoComplete="name" {...register('name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Mobile number" hint="Verified by OTP — used to log in">
          <Input
            type="tel"
            value={user?.phone ? `+91 ${user.phone}` : 'Not set'}
            readOnly
            disabled
          />
        </Field>
      </div>
      <Button type="submit" className="self-end" loading={isSubmitting} disabled={!isDirty}>
        Save profile
      </Button>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(passwordForm),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await authService.changePassword({ currentPassword, newPassword });
      reset();
      toast.success('Password changed');
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="card flex flex-col gap-5 p-5 sm:p-6">
      <h2 className="text-lg font-bold">Change password</h2>
      {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
      <Field label="Current password" error={errors.currentPassword?.message} required>
        <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
      </Field>
      <Field
        label="New password"
        error={errors.newPassword?.message}
        hint="At least 8 characters with a letter and a number"
        required
      >
        <PasswordInput autoComplete="new-password" {...register('newPassword')} />
      </Field>
      <Field label="Confirm new password" error={errors.confirm?.message} required>
        <PasswordInput autoComplete="new-password" {...register('confirm')} />
      </Field>
      <Button type="submit" className="self-end" loading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { user } = useAuth();
  return (
    <div className="container-page flex max-w-xl flex-col gap-5 py-6 sm:py-8">
      <PageHeader title="Account settings" back="/profile" className="mb-0" />
      <ProfileForm />
      {/* Only admin accounts have a password; everyone else signs in with OTP. */}
      {user?.role === 'admin' && <PasswordForm />}
    </div>
  );
}
