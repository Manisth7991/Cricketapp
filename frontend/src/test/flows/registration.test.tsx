import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterTeamPage from '@/pages/tournaments/RegisterTeamPage';
import { renderRoute } from '../utils';
import { sports, teams, tournament, user } from '../fixtures';
import { ApiClientError } from '@/services/api';

const register = vi.fn();

vi.mock('@/services/authService', () => ({ authService: { session: vi.fn(async () => user) } }));
vi.mock('@/services/sportService', () => ({ sportService: { list: vi.fn(async () => sports) } }));
vi.mock('@/services/teamService', () => ({
  teamService: { list: vi.fn(async () => [teams.ready, teams.empty, teams.registered]) },
}));
vi.mock('@/services/tournamentService', () => ({
  tournamentService: {
    get: vi.fn(async () => tournament),
    myRegistrationsFor: vi.fn(async () => [
      { id: 'r0', status: 'confirmed', teamId: teams.registered.id },
    ]),
  },
}));
vi.mock('@/services/registrationService', () => ({
  registrationService: { register: (...a: unknown[]) => register(...a) },
}));

function renderPage() {
  return renderRoute(<RegisterTeamPage />, {
    path: '/tournaments/:id/register',
    url: '/tournaments/t1/register',
    extraRoutes: [{ path: '/tournaments/:id/register/success', element: <p>SUCCESS PAGE</p> }],
  });
}

describe('Register team flow', () => {
  // Block body on purpose: a function returned from beforeEach is treated as a teardown hook.
  beforeEach(() => {
    register.mockReset();
  });

  it('lists teams and disables ineligible ones with a reason', async () => {
    renderPage();
    expect(await screen.findByText('Palsana Panthers')).toBeInTheDocument();
    expect(screen.getByText('Add at least one player first')).toBeInTheDocument();
    expect(screen.getByText('Already registered for this tournament')).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.filter((r) => (r as HTMLInputElement).disabled)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('requires the entry-fee acknowledgement, then submits and shows success', async () => {
    const u = userEvent.setup();
    register.mockResolvedValue({
      id: 'r1',
      status: 'pending',
      tournamentId: 't1',
      teamId: teams.ready.id,
      team: { name: teams.ready.name },
    });
    renderPage();
    await u.click(await screen.findByText('Palsana Panthers'));
    await u.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Player 11')).toBeInTheDocument(); // roster preview on review step
    await u.click(screen.getByRole('button', { name: 'Submit registration' }));
    expect(await screen.findByText('Please confirm to continue')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();

    await u.click(screen.getByRole('checkbox'));
    await u.type(screen.getByLabelText(/note to organiser/i), 'Evening slots please');
    await u.click(screen.getByRole('button', { name: 'Submit registration' }));
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith('t1', {
        teamId: teams.ready.id,
        note: 'Evening slots please',
      }),
    );
    expect(await screen.findByText('SUCCESS PAGE')).toBeInTheDocument();
  });

  it('shows the server error message (e.g. registration closed) without leaving the page', async () => {
    const u = userEvent.setup();
    register.mockImplementation(async () => {
      throw new ApiClientError(409, 'REGISTRATION_CLOSED', 'Registration is closed.');
    });
    renderPage();
    await u.click(await screen.findByText('Palsana Panthers'));
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    await u.click(await screen.findByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Submit registration' }));
    expect(await screen.findByText('Registration is closed.')).toBeInTheDocument();
    expect(screen.queryByText('SUCCESS PAGE')).not.toBeInTheDocument();
  });
});
