import type {
  ChangePasswordInput,
  LoginInput,
  OtpCompleteInput,
  OtpRequestInput,
  OtpVerifyInput,
  UpdateProfileInput,
  UserDTO,
} from '@playlocal/shared';
import { get, patch, post } from './api';

export interface OtpRequestResult {
  expiresIn: number;
  resendIn: number;
  /** Only returned by the API in development (console SMS provider). */
  devCode?: string;
}

export type OtpVerifyResult =
  { status: 'logged_in'; user: UserDTO } | { status: 'new_user'; ticket: string };

export const authService = {
  me: () => get<{ user: UserDTO }>('/auth/me').then((d) => d.user),
  session: () => get<{ user: UserDTO | null }>('/auth/session').then((d) => d.user),
  requestOtp: (body: OtpRequestInput) => post<OtpRequestResult>('/auth/otp/request', body),
  verifyOtp: (body: OtpVerifyInput) => post<OtpVerifyResult>('/auth/otp/verify', body),
  completeSignup: (body: OtpCompleteInput) =>
    post<{ user: UserDTO }>('/auth/otp/complete', body).then((d) => d.user),
  adminLogin: (body: LoginInput) =>
    post<{ user: UserDTO }>('/auth/admin/login', body).then((d) => d.user),
  logout: () => post<null>('/auth/logout'),
  updateProfile: (body: UpdateProfileInput) =>
    patch<{ user: UserDTO }>('/auth/me', body).then((d) => d.user),
  changePassword: (body: ChangePasswordInput) => post<null>('/auth/change-password', body),
};
