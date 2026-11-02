jest.mock('../src/utils/adminSessions', () => ({
  verifyAdminSessionToken: jest.fn(),
}));
const { verifyAdminSessionToken } = require('../src/utils/adminSessions');
const websocket = require('../src/api/websocket');
describe('Privileged Nexus real-time delivery', () => {
  afterEach(() => {
    websocket.clients.clear();
    jest.restoreAllMocks();
  });
  it('never sends privileged data to display/anonymous clients and rechecks revoked sessions', () => {
    const admin = { adminToken: 'admin' };
    const anonymous = {};
    const display = { adminToken: 'display' };
    websocket.clients = new Set([admin, anonymous, display]);
    const send = jest.spyOn(websocket, 'send').mockImplementation(() => {});
    verifyAdminSessionToken.mockImplementation((token) =>
      token === 'admin' ? { role: 'admin' } : null,
    );
    websocket.broadcastAdmin({ type: 'clock_state' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(admin);
    verifyAdminSessionToken.mockReturnValue(null);
    send.mockClear();
    websocket.broadcastAdmin({ type: 'devices_state' });
    expect(send).not.toHaveBeenCalled();
  });
});
