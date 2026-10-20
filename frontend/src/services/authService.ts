import type {
  FirebaseTokenInput,
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

/** One auth flow for everyone — admins are phone accounts whose role is `admin`. */
export const authService = {
  me: () => get<{ user: UserDTO }>('/auth/me').then((d) => d.user),
  session: () => get<{ user: UserDTO | null }>('/auth/session').then((d) => d.user),
  requestOtp: (body: OtpRequestInput) => post<OtpRequestResult>('/auth/otp/request', body),
  verifyOtp: (body: OtpVerifyInput) => post<OtpVerifyResult>('/auth/otp/verify', body),
  completeSignup: (body: OtpCompleteInput) =>
    post<{ user: UserDTO }>('/auth/otp/complete', body).then((d) => d.user),
  /** Logged-in organiser verifying a WhatsApp number that differs from their login number. */
  verifyContactOtp: (body: OtpVerifyInput) =>
    post<{ ticket: string; phone: string }>('/auth/otp/verify-contact', body),
  /** Firebase Phone Auth equivalents: the browser confirmed the SMS, the API checks the ID token. */
  firebaseVerify: (body: FirebaseTokenInput) =>
    post<OtpVerifyResult>('/auth/firebase/verify', body),
  firebaseVerifyContact: (body: FirebaseTokenInput) =>
    post<{ ticket: string; phone: string }>('/auth/firebase/verify-contact', body),
  logout: () => post<null>('/auth/logout'),
  updateProfile: (body: UpdateProfileInput) =>
    patch<{ user: UserDTO }>('/auth/me', body).then((d) => d.user),
};
