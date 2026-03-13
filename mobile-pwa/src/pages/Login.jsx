import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import './Login.css';
import { apiFetch } from '../apiClient';

export default function Login() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const existingToken = window.localStorage.getItem('adminToken');
    if (existingToken) {
        return <Navigate to="/dashboard" replace />;
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
            if (!res.ok || !json.token) {
                throw new Error(json.error || 'Invalid password');
            }

            window.localStorage.setItem('adminToken', json.token);
            navigate('/dashboard', { replace: true });
        } catch (loginError) {
            setError(loginError.message || 'Login failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <h1>Smart Mirror</h1>
                <p>Sign in to access the dashboard</p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Admin password"
                        autoComplete="current-password"
                    />
                    {error ? <div className="login-error">{error}</div> : null}
                    <button type="submit" disabled={busy || !password}>
                        {busy ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
