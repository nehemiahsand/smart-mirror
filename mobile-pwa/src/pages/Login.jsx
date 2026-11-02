import { Button } from '../components/NexusUI';
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import './Login.css';
import { apiFetch } from '../api/apiClient';

export default function Login({
    sessionChecked = false,
    authenticated = false,
    onAuthChange = () => {}
}) {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (!sessionChecked) {
        return <div className="loading">Loading...</div>;
    }

    if (authenticated) {
        return <Navigate to="/home" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password || busy) return;

        setBusy(true);
        setError('');
        try {
            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.authenticated) {
                throw new Error(json.error || 'Invalid password');
            }

            onAuthChange(true);
            navigate('/home', { replace: true });
        } catch (loginError) {
            setError(loginError.message || 'Login failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <h1>Nexus</h1>
                <p>Sign in to your connected setup</p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Admin password"
                        autoComplete="current-password"
                        aria-label="Admin password"
                    />
                    {error ? <div className="login-error">{error}</div> : null}
                    <Button type="submit" disabled={busy || !password}>
                        {busy ? 'Signing In...' : 'Sign In'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
