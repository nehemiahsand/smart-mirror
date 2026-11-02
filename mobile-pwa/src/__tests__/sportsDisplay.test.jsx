import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { YouTubeVideoPanel } from '../../../display/src/components/SportsPage';
const players = [];
const items = ['abcdefghijk', 'lmnopqrstuv'].map((videoId) => ({ videoId, title: videoId }));
const feed = (changes = {}) => ({ items, selectedClipIndex: 0, fetchedAt: '2026-10-30T15:00:00Z', ...changes });
afterEach(() => { cleanup(); players.length = 0; delete window.YT; vi.restoreAllMocks(); });
function playerAPI() {
    window.YT = { Player: vi.fn(function (node, config) {
        this.destroy = vi.fn(); this.playVideo = vi.fn(); this.mute = vi.fn(); this.getIframe = () => document.createElement('iframe');
        players.push({ config, player: this });
    }) };
}
describe('Physical display highlights', () => {
    it('starts an identified embed before the optional diagnostics SDK loads', async () => {
        render(<YouTubeVideoPanel videoFeed={feed()} />);
        const iframe = await screen.findByTitle(items[0].title);
        expect(iframe.src).toContain('enablejsapi=1');
        expect(iframe.referrerPolicy).toBe('strict-origin-when-cross-origin');
        expect(iframe.allow).toContain('autoplay');
    });
    it('does not report playback success from player readiness alone', async () => {
        playerAPI(); render(<YouTubeVideoPanel videoFeed={feed()} />);
        await waitFor(() => expect(players).toHaveLength(1));
        act(() => players[0].config.events.onReady({ target: players[0].player }));
        expect(screen.getByText('Connecting to highlights…')).toBeInTheDocument();
        act(() => players[0].config.events.onStateChange({ data: 1 }));
        expect(screen.queryByText('Connecting to highlights…')).toBeNull();
    });
    it('skips unplayable clips, survives unchanged polls, and stops after all clips fail', async () => {
        playerAPI(); const { rerender } = render(<YouTubeVideoPanel videoFeed={feed()} />);
        await waitFor(() => expect(players).toHaveLength(1));
        act(() => players[0].config.events.onError({ data: 101 }));
        await waitFor(() => expect(players).toHaveLength(2));
        expect(players[1].config.videoId).toBe(items[1].videoId);
        rerender(<YouTubeVideoPanel videoFeed={feed({ fetchedAt: '2026-10-30T15:01:00Z' })} />);
        expect(players).toHaveLength(2);
        act(() => players[1].config.events.onError({ data: 150 }));
        expect(screen.getByText('The publisher does not allow this highlight to play on other websites.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry highlights' }));
        await waitFor(() => expect(players).toHaveLength(3));
    });
    it('distinguishes client identification errors and blocked autoplay', async () => {
        playerAPI(); render(<YouTubeVideoPanel videoFeed={feed()} />);
        await waitFor(() => expect(players).toHaveLength(1));
        act(() => players[0].config.events.onAutoplayBlocked());
        fireEvent.click(screen.getByRole('button', { name: 'Play highlights' }));
        expect(players[0].player.playVideo).toHaveBeenCalledTimes(1);
        act(() => players[0].config.events.onError({ data: 153 }));
        expect(screen.getByText('YouTube could not identify the mirror’s website. Check its referrer policy.')).toBeInTheDocument();
        expect(players).toHaveLength(1);
    });
});

it('keeps a football game selectable with its box score when the pinned channel has no video', () => {
    playerAPI();
    const game = { gameId: 'football-1', dateFormatted: 'Oct 25, 2026', homeAway: 'away', result: 'W', home: { abbrev: 'LSU', score: 16 }, away: { abbrev: 'AUB', score: 30 }, boxScore: { sport: 'football', team: { categories: [{ id: 'passing', labels: ['YDS', 'TD'], players: [{ name: 'Quarterback', stats: ['222','0'] }], totals: ['222','0'] }], statistics: [{ id: 'turnovers', label: 'Turnovers', value: '0' }] }, opponent: { categories: [], statistics: [] } } };
    const football = { items: [{ videoId: null, title: 'Auburn vs LSU', message: 'No ESPN College Football highlight for this game yet.', game }], viewMode: 'video' };
    const { rerender } = render(<YouTubeVideoPanel videoFeed={football} />);
    expect(screen.getByText('No ESPN College Football highlight for this game yet.')).toBeInTheDocument();
    expect(players).toHaveLength(0);
    rerender(<YouTubeVideoPanel videoFeed={{ ...football, viewMode: 'boxscore' }} />);
    expect(screen.getByText('Passing')).toBeInTheDocument();
    expect(screen.getByText('Quarterback')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(players).toHaveLength(0);
});

it('retains the selected game and available stats when its publisher blocks YouTube playback', async () => {
    playerAPI();
    const game = { gameId: 'blocked-game', home: { abbrev: 'LSU' }, away: { abbrev: 'AUB' } };
    render(<YouTubeVideoPanel videoFeed={feed({ items: [{ ...items[0], game }, { ...items[1], game: { ...game, gameId: 'other' } }] })} />);
    await waitFor(() => expect(players).toHaveLength(1));
    act(() => players[0].config.events.onError({ data: 150 }));
    expect(players).toHaveLength(1);
    expect(screen.getByText('Game 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open highlights' }).href).toContain(items[0].videoId);
    expect(screen.getByText('Box-score statistics are unavailable for this game.')).toBeInTheDocument();
});
