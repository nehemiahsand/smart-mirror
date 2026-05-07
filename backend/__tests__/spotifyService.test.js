function createSpotifyServiceTestContext(spotifySettings = {}) {
    jest.resetModules();

    const settingsService = {
        get: jest.fn((path) => {
            if (path === 'spotify') {
                return spotifySettings;
            }
            return undefined;
        }),
        getAll: jest.fn(() => ({
            spotify: {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiry: Date.now() + 3600000,
                ...spotifySettings,
            },
        })),
        updateMultiple: jest.fn(async () => ({})),
    };

    const axios = jest.fn();
    axios.post = jest.fn();

    jest.doMock('axios', () => axios);
    jest.doMock('../src/services/settings', () => settingsService);
    jest.doMock('../src/utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }));

    const spotifyService = require('../src/services/spotify');
    return { axios, settingsService, spotifyService };
}

function noActiveDeviceError() {
    const error = new Error('Request failed with status code 404');
    error.response = {
        status: 404,
        data: {
            error: {
                status: 404,
                message: 'Player command failed: No active device found',
                reason: 'NO_ACTIVE_DEVICE',
            },
        },
    };
    return error;
}

describe('SpotifyService playback device recovery', () => {
    it('transfers playback and retries next when Spotify reports no active device', async () => {
        const { axios, spotifyService } = createSpotifyServiceTestContext();

        axios
            .mockRejectedValueOnce(noActiveDeviceError())
            .mockResolvedValueOnce({
                data: {
                    devices: [
                        {
                            id: 'device-1',
                            is_active: false,
                            is_restricted: false,
                            name: 'Kitchen Speaker',
                        },
                    ],
                },
            })
            .mockResolvedValueOnce({ data: {} })
            .mockResolvedValueOnce({ data: {} });

        await spotifyService.next();

        expect(axios).toHaveBeenNthCalledWith(1, expect.objectContaining({
            method: 'POST',
            url: 'https://api.spotify.com/v1/me/player/next',
        }));
        expect(axios).toHaveBeenNthCalledWith(2, expect.objectContaining({
            method: 'GET',
            url: 'https://api.spotify.com/v1/me/player/devices',
        }));
        expect(axios).toHaveBeenNthCalledWith(3, expect.objectContaining({
            method: 'PUT',
            url: 'https://api.spotify.com/v1/me/player',
            data: {
                device_ids: ['device-1'],
                play: true,
            },
        }));
        expect(axios).toHaveBeenNthCalledWith(4, expect.objectContaining({
            method: 'POST',
            url: 'https://api.spotify.com/v1/me/player/next?device_id=device-1',
        }));
    });

    it('uses a configured preferred device when activating playback', async () => {
        const { axios, spotifyService } = createSpotifyServiceTestContext({
            preferredDeviceName: 'Office Mac',
        });

        axios
            .mockRejectedValueOnce(noActiveDeviceError())
            .mockResolvedValueOnce({
                data: {
                    devices: [
                        {
                            id: 'device-1',
                            is_active: false,
                            is_restricted: false,
                            name: 'Kitchen Speaker',
                        },
                        {
                            id: 'device-2',
                            is_active: false,
                            is_restricted: false,
                            name: 'Office Mac',
                        },
                    ],
                },
            })
            .mockResolvedValueOnce({ data: {} })
            .mockResolvedValueOnce({ data: {} });

        await spotifyService.play();

        expect(axios).toHaveBeenNthCalledWith(3, expect.objectContaining({
            data: {
                device_ids: ['device-2'],
                play: false,
            },
        }));
        expect(axios).toHaveBeenNthCalledWith(4, expect.objectContaining({
            method: 'PUT',
            url: 'https://api.spotify.com/v1/me/player/play?device_id=device-2',
        }));
    });

    it('treats pause with no active device as already paused', async () => {
        const { axios, spotifyService } = createSpotifyServiceTestContext();

        axios.mockRejectedValueOnce(noActiveDeviceError());

        await expect(spotifyService.pause()).resolves.toBeNull();
        expect(axios).toHaveBeenCalledTimes(1);
    });
});
