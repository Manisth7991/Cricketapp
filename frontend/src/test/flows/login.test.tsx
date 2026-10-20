import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/pages/auth/LoginPage';
import { renderRoute } from '../utils';
import { user } from '../fixtures';
import { ApiClientError } from '@/services/api';

const requestOtp = vi.fn();
const verifyOtp = vi.fn();
const completeSignup = vi.fn();

vi.mock('@/services/authService', () => ({
  authService: {
    session: vi.fn(async () => null),
    requestOtp: (...a: unknown[]) => requestOtp(...a),
    verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    completeSignup: (...a: unknown[]) => completeSignup(...a),
  },
}));

function renderLogin(url = '/login?next=/explore') {
  return renderRoute(<LoginPage />, {
    path: '/login',
    url,
    extraRoutes: [
      { path: '/explore', element: <p>EXPLORE PAGE</p> },
      { path: '/location', element: <p>LOCATION PAGE</p> },
    ],
  });
}

describe('Phone OTP login / sign-up', () => {
  beforeEach(() => {
    requestOtp.mockReset();
    verifyOtp.mockReset();
    completeSignup.mockReset();
  });

  it('validates the mobile number before requesting an OTP', async () => {
    const u = userEvent.setup();
    renderLogin();
    await u.type(await screen.findByLabelText('Mobile number'), '12345');
    await u.click(screen.getByRole('button', { name: 'Get OTP' }));
    expect(
      await screen.findByText('Enter a valid 10-digit Indian mobile number'),
    ).toBeInTheDocument();
    expect(requestOtp).not.toHaveBeenCalled();
  });

  it('existing user: number → code (auto-submits at 6 digits) → logged in and redirected', async () => {
    const u = userEvent.setup();
    requestOtp.mockResolvedValue({ expiresIn: 300, resendIn: 30, devCode: '482913' });
    verifyOtp.mockResolvedValue({ status: 'logged_in', user });
    renderLogin();
    await u.type(await screen.findByLabelText('Mobile number'), '98765 43210');
    await u.click(screen.getByRole('button', { name: 'Get OTP' }));

    expect(await screen.findByText('+91 98765 43210')).toBeInTheDocument();
    expect(screen.getByText('482913')).toBeInTheDocument(); // dev-mode banner
    expect(screen.getByText(/Resend in/)).toBeInTheDocument();
    expect(requestOtp).toHaveBeenCalledWith({ phone: '9876543210' });

    await u.type(screen.getByLabelText('6-digit code'), '482913');
    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({ phone: '9876543210', code: '482913' }),
    );
    expect(await screen.findByText('EXPLORE PAGE')).toBeInTheDocument();
  });

  it('new user: verify → asks for name → creates account → location step', async () => {
    const u = userEvent.setup();
    requestOtp.mockResolvedValue({ expiresIn: 300, resendIn: 30 });
    verifyOtp.mockResolvedValue({ status: 'new_user', ticket: 'signup-ticket-xyz-0123456789' });
    completeSignup.mockResolvedValue(user);
    renderLogin();
    await u.type(await screen.findByLabelText('Mobile number'), '9876543210');
    await u.click(screen.getByRole('button', { name: 'Get OTP' }));
    await u.type(await screen.findByLabelText('6-digit code'), '111222');

    expect(await screen.findByText('Welcome to PlayLocal! 🎉')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Please enter your name')).toBeInTheDocument();

    await u.type(screen.getByLabelText(/full name/i), 'Priya Verma');
    await u.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(completeSignup).toHaveBeenCalledWith({
        ticket: 'signup-ticket-xyz-0123456789',
        name: 'Priya Verma',
        email: undefined,
      }),
    );
    expect(await screen.findByText('LOCATION PAGE')).toBeInTheDocument();
  });

  it('shows the server message for a wrong code and lets the user retry', async () => {
    const u = userEvent.setup();
    requestOtp.mockResolvedValue({ expiresIn: 300, resendIn: 30 });
    verifyOtp.mockImplementation(async () => {
      throw new ApiClientError(400, 'OTP_INVALID', 'Incorrect code. 4 attempts left.');
    });
    renderLogin();
    await u.type(await screen.findByLabelText('Mobile number'), '9876543210');
    await u.click(screen.getByRole('button', { name: 'Get OTP' }));
    await u.type(await screen.findByLabelText('6-digit code'), '000000');
    expect(await screen.findByText('Incorrect code. 4 attempts left.')).toBeInTheDocument();
    expect(screen.queryByText('EXPLORE PAGE')).not.toBeInTheDocument();
  });
});
