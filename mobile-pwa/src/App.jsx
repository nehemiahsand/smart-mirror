import React, { useEffect, useState, useId, lazy, Suspense } from 'react';
import {
    createBrowserRouter,
    RouterProvider,
    NavLink,
    Navigate,
    Route,
    Routes,
    useLocation
} from 'react-router-dom';
import {
    Activity,
    House,
    AlarmClock,
    LampDesk,
    Network,
    PanelsTopLeft,
    Settings2
} from 'lucide-react';
import { NexusProvider, useNexus } from './state/NexusProvider';
import { fetchAuthSession } from './api/apiClient';
import Login from './pages/Login';
const Home = lazy(() => import('./pages/Home'));
const Mirror = lazy(() => import('./pages/Mirror'));
const Alarms = lazy(() => import('./pages/Alarms'));
const Lights = lazy(() => import('./pages/Lights'));
const Monitor = lazy(() => import('./pages/Monitor'));
const NexusSettings = lazy(() => import('./pages/NexusSettings'));
import { Button, Notice } from './components/NexusUI';
import { m, useReducedMotion } from 'motion/react';
import './assets/styles/nexus.css';

const destinations = [
    ['home', 'Home', House, '/home'],
    ['mirror', 'Mirror', PanelsTopLeft, '/mirror/controls'],
    ['alarms', 'Alarms', AlarmClock, '/alarms/alarms'],
    ['lights', 'Lights', LampDesk, '/lights'],
    ['monitor', 'Monitor', Activity, '/monitor/devices'],
    ['settings', 'Settings', Settings2, '/settings']
];
function Navigation({ current }) {
    const id = useId();
    const reduced = useReducedMotion();
    return (
        <nav className="nexus-navigation" aria-label="Main navigation">
            {destinations.map(([key, name, Icon, path]) => (
                <NavLink
                    key={key}
                    to={path}
                    aria-current={current === key ? 'page' : undefined}
                    className={`nav-${key} ${current === key ? 'selected' : ''}`}
                >
                    {current === key && (
                        <m.span
                            className="nav-active-background"
                            layoutId={`${id}-nav`}
                            transition={{ duration: reduced ? 0 : 0.22 }}
                        />
                    )}
                    <span className="nav-icon">
                        <Icon />
                    </span>
                    <span>{name}</span>
                </NavLink>
            ))}
        </nav>
    );
}
function Shell({ onLogout }) {
    const { data, connected, request, refresh } = useNexus();
    const { pathname } = useLocation();
    const reduced = useReducedMotion();
    const current =
        destinations.find(([key]) => pathname.startsWith(`/${key}`)) ||
        destinations[0];
    const [error, setError] = useState('');
    const [dismissing, setDismissing] = useState(false);
    async function dismiss() {
        setDismissing(true);
        setError('');
        try {
            await request('/api/clock/command', {
                action: 'alarm.dismiss',
                requestId: crypto.randomUUID()
            });
            await refresh('clock');
        } catch (e) {
            setError(e.message);
        } finally {
            setDismissing(false);
        }
    }
    return (
        <div className="nexus-app">
            <aside className="nexus-sidebar">
                <div className="nexus-brand">
                    <span className="brand-mark">
                        <Network />
                    </span>
                    Nexus
                </div>
                <p>Your connected setup.</p>
                <Navigation current={current[0]} />
            </aside>
            <div className="nexus-workspace">
                <header className="nexus-topbar">
                    <div className="nexus-brand">
                        <span className="brand-mark">
                            <Network />
                        </span>
                        Nexus
                    </div>
                    <NavLink
                        className="nexus-settings-shortcut"
                        to="/settings"
                        aria-label="Settings"
                        aria-current={
                            current[0] === 'settings' ? 'page' : undefined
                        }
                    >
                        <Settings2 />
                    </NavLink>
                    <span className={`connection ${connected ? '' : 'muted'}`}>
                        {connected ? 'Connected' : 'Reconnecting'}
                    </span>
                </header>
                {data.clock?.state?.ringing && (
                    <div className="ringing-banner" role="status">
                        <AlarmClock />
                        <div>
                            <strong>Alarm ringing</strong>
                            <small>
                                {data.clock.state.ringingInferred
                                    ? 'Inferred · Sharp clock'
                                    : 'Sharp clock'}
                            </small>
                        </div>
                        <Button
                            onClick={dismiss}
                            disabled={
                                dismissing ||
                                !data.clock.online ||
                                !data.clock.fresh ||
                                data.clock.state.sharpBusy
                            }
                        >
                            Dismiss
                        </Button>
                    </div>
                )}
                <Notice error={error} />
                <m.main
                    key={pathname}
                    id="main-content"
                    className="nexus-main"
                    initial={reduced ? false : { opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                >
                    <Suspense
                        fallback={
                            <p className="hint" role="status">
                                Opening view…
                            </p>
                        }
                    >
                        <Routes>
                            <Route path="/home" element={<Home />} />
                            <Route path="/mirror/:view" element={<Mirror />} />
                            <Route path="/alarms/:view" element={<Alarms />} />
                            <Route path="/lights" element={<Lights />} />
                            <Route
                                path="/monitor/:view"
                                element={<Monitor />}
                            />
                            <Route
                                path="/monitor/devices/:id"
                                element={<Monitor />}
                            />
                            <Route
                                path="/monitor/devices/:id/network"
                                element={<Monitor />}
                            />
                            <Route
                                path="/settings/*"
                                element={<NexusSettings onLogout={onLogout} />}
                            />
                            {Object.entries({
                                '/': '/home',
                                '/dashboard': '/home',
                                '/camera': '/mirror/camera',
                                '/photos': '/mirror/photos',
                                '/widgets': '/mirror/edit',
                                '/sports': '/mirror/edit?section=sports',
                                '/wifi': '/monitor/devices/mirror/network',
                                '/more': '/settings',
                                '/mirror': '/mirror/controls',
                                '/alarms': '/alarms/alarms',
                                '/monitor': '/monitor/devices'
                            }).map(([from, to]) => (
                                <Route
                                    key={from}
                                    path={from}
                                    element={<Navigate to={to} replace />}
                                />
                            ))}
                            <Route
                                path="*"
                                element={<Navigate to="/home" replace />}
                            />
                        </Routes>
                    </Suspense>
                </m.main>
                <Navigation current={current[0]} />
            </div>
        </div>
    );
}
function Session() {
    const [session, setSession] = useState({
        checked: false,
        authenticated: false
    });
    const location = useLocation();
    useEffect(() => {
        let active = true;
        fetchAuthSession()
            .then((result) => {
                if (active)
                    setSession({
                        checked: true,
                        authenticated: result.authenticated === true
                    });
            })
            .catch(() => {
                if (active) setSession({ checked: true, authenticated: false });
            });
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        const expire = () =>
            setSession({ checked: true, authenticated: false });
        window.addEventListener('nexus:unauthorized', expire);
        return () => window.removeEventListener('nexus:unauthorized', expire);
    }, []);
    if (!session.checked)
        return <div className="nexus-loading">Connecting to Nexus…</div>;
    if (!session.authenticated || location.pathname === '/login')
        return (
            <Login
                sessionChecked
                authenticated={session.authenticated}
                onAuthChange={(authenticated) =>
                    setSession({ checked: true, authenticated })
                }
            />
        );
    return (
        <NexusProvider>
            <Shell
                onLogout={() =>
                    setSession({ checked: true, authenticated: false })
                }
            />
        </NexusProvider>
    );
}
const router = createBrowserRouter([{ path: '*', element: <Session /> }]);
export default function App() {
    return (
        <>
            {import.meta.env.VITE_NEXUS_PREVIEW === 'true' && (
                <div className="preview-banner" role="status">
                    Nexus preview · Simulated devices · Changes reset when
                    restarted
                </div>
            )}
            <RouterProvider router={router} />
        </>
    );
}
