import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema } from '@playlocal/shared';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { authService } from '@/services/authService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { applyServerErrors } from '@/utils/forms';

const profileForm = updateProfileSchema.pick({ name: true, email: true, profileImage: true });

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

/** Everyone signs in with phone + OTP, so there is no password to manage here. */
export default function SettingsPage() {
  useDocumentTitle('Settings');
  return (
    <div className="container-page flex max-w-xl flex-col gap-5 py-6 sm:py-8">
      <PageHeader title="Account settings" back="/profile" className="mb-0" />
      <ProfileForm />
    </div>
  );
}
