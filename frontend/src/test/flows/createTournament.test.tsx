import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TournamentEditorPage from '@/pages/create/TournamentEditorPage';
import { renderRoute } from '../utils';
import { sports, tournament, user } from '../fixtures';
import { ApiClientError } from '@/services/api';

const createDraft = vi.fn();
const submit = vi.fn();
const get = vi.fn();

vi.mock('@/services/authService', () => ({
  authService: { session: vi.fn(async () => ({ ...user, id: 'org1' })) },
}));
vi.mock('@/services/sportService', () => ({ sportService: { list: vi.fn(async () => sports) } }));
vi.mock('@/services/tournamentService', () => ({
  tournamentService: {
    get: (...a: unknown[]) => get(...a),
    createDraft: (...a: unknown[]) => createDraft(...a),
    submit: (...a: unknown[]) => submit(...a),
  },
}));

const routes = [
  { path: '/tournaments/:id/edit/:step?', element: <TournamentEditorPage /> },
  { path: '/tournaments/:id/submitted', element: <p>SUBMITTED PAGE</p> },
];

describe('Create tournament flow', () => {
  beforeEach(() => {
    createDraft.mockReset();
    submit.mockReset();
    get.mockReset();
  });

  it('validates the basics step before creating a draft', async () => {
    const u = userEvent.setup();
    renderRoute(<TournamentEditorPage />, {
      path: '/create/tournament',
      url: '/create/tournament',
      extraRoutes: routes,
    });
    await u.click(await screen.findByRole('button', { name: 'Create draft & continue' }));
    expect(
      await screen.findByText('Tournament name must be at least 3 characters'),
    ).toBeInTheDocument();
    expect(screen.getByText('Description must be at least 20 characters')).toBeInTheDocument();
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('creates a draft and moves to the location step', async () => {
    const u = userEvent.setup();
    const draft = {
      ...tournament,
      id: 'new1',
      status: 'draft' as const,
      verified: false,
      venue: {},
      organizerId: 'org1',
    };
    createDraft.mockResolvedValue(draft);
    get.mockResolvedValue(draft);
    renderRoute(<TournamentEditorPage />, {
      path: '/create/tournament',
      url: '/create/tournament',
      extraRoutes: routes,
    });

    await u.type(await screen.findByLabelText(/tournament name/i), 'Sikar Night Cup');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(1));
    await u.selectOptions(screen.getByLabelText(/^sport/i), 'cricket');
    await u.type(
      screen.getByLabelText(/description/i),
      'An exciting night cricket tournament for local teams.',
    );
    await u.click(screen.getByRole('button', { name: 'Create draft & continue' }));

    await waitFor(() =>
      expect(createDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sikar Night Cup',
          sport: 'cricket',
          description: 'An exciting night cricket tournament for local teams.',
        }),
      ),
    );
    expect(await screen.findByText('Where is it?')).toBeInTheDocument();
  });

  it('review step blocks submission while details are missing', async () => {
    get.mockResolvedValue({
      ...tournament,
      status: 'draft',
      verified: false,
      organizerId: 'org1',
      venue: { name: 'Stadium' },
    });
    renderRoute(<TournamentEditorPage />, {
      path: '/tournaments/:id/edit/:step?',
      url: '/tournaments/t1/edit/review',
      extraRoutes: routes.slice(1),
    });
    expect(await screen.findByText('A few details are still missing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for verification' })).toBeDisabled();
  });

  it('submits a complete draft for verification', async () => {
    const u = userEvent.setup();
    const complete = {
      ...tournament,
      status: 'draft' as const,
      verified: false,
      organizerId: 'org1',
      description: 'A complete description of the event.',
    };
    get.mockResolvedValue(complete);
    submit.mockResolvedValue({ ...complete, status: 'pending_verification' });
    renderRoute(<TournamentEditorPage />, {
      path: '/tournaments/:id/edit/:step?',
      url: '/tournaments/t1/edit/review',
      extraRoutes: routes.slice(1),
    });
    const btn = await screen.findByRole('button', { name: 'Submit for verification' });
    expect(btn).toBeEnabled();
    await u.click(btn);
    expect(await screen.findByText('SUBMITTED PAGE')).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith('t1');
  });

  it('surfaces server-side incompleteness errors', async () => {
    const u = userEvent.setup();
    const complete = {
      ...tournament,
      status: 'draft' as const,
      verified: false,
      organizerId: 'org1',
      description: 'A complete description of the event.',
    };
    get.mockResolvedValue(complete);
    submit.mockImplementation(async () => {
      throw new ApiClientError(
        400,
        'TOURNAMENT_INCOMPLETE',
        'Please complete all required details before submitting.',
        [{ path: 'startDate', message: 'Start date cannot be in the past' }],
      );
    });
    renderRoute(<TournamentEditorPage />, {
      path: '/tournaments/:id/edit/:step?',
      url: '/tournaments/t1/edit/review',
      extraRoutes: routes.slice(1),
    });
    await u.click(await screen.findByRole('button', { name: 'Submit for verification' }));
    expect(await screen.findByText('Start date cannot be in the past')).toBeInTheDocument();
  });
});
