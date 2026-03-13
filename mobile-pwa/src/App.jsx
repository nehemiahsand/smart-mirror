import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import WiFiSettings from './pages/WiFiSettings';
import Camera from './pages/Camera';
import WidgetManager from './pages/WidgetManager';
import Photos from './pages/Photos';
import Settings from './pages/Settings';
import SportsSettings from './pages/SportsSettings';
import MoreMenu from './pages/MoreMenu';
import Login from './pages/Login';
import './components/common.css';
import './App.css';
import { fetchAuthSession } from './apiClient';

function App() {
  return (
    <Router>
      <div className="app">
        <AppContent />
      </div>
    </Router>
  );
}

function AppContent() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authState, setAuthState] = useState({ checked: false, authenticated: false });
  const isLoginPage = location.pathname === '/login';

  useEffect(() => {
    const path = location.pathname.slice(1) || 'dashboard';
    setActiveTab(path);
  }, [location]);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const session = await fetchAuthSession();
        if (!active) return;
        setAuthState({ checked: true, authenticated: session.authenticated === true });
      } catch (_) {
        if (!active) return;
        setAuthState({ checked: true, authenticated: false });
      }
    };

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  const RequireAuth = ({ children }) => {
    if (!authState.checked) {
      return <div className="loading">Loading...</div>;
    }

    if (!authState.authenticated) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  const handleAuthChange = (authenticated) => {
    setAuthState({ checked: true, authenticated });
  };

  return (
    <>
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login sessionChecked={authState.checked} authenticated={authState.authenticated} onAuthChange={handleAuthChange} />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/wifi" element={<RequireAuth><WiFiSettings /></RequireAuth>} />
          <Route path="/camera" element={<RequireAuth><Camera /></RequireAuth>} />
          <Route path="/widgets" element={<RequireAuth><WidgetManager /></RequireAuth>} />
          <Route path="/photos" element={<RequireAuth><Photos /></RequireAuth>} />
          <Route path="/sports" element={<RequireAuth><SportsSettings /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings authenticated={authState.authenticated} onAuthChange={handleAuthChange} /></RequireAuth>} />
          <Route path="/more" element={<RequireAuth><MoreMenu /></RequireAuth>} />
        </Routes>
      </main>

      {!isLoginPage && <nav className="bottom-nav">
        <Link to="/dashboard" className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="nav-label">Home</span>
        </Link>

        <Link to="/camera" className={`nav-item ${activeTab === 'camera' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="nav-label">Camera</span>
        </Link>

        <Link to="/photos" className={`nav-item ${activeTab === 'photos' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="nav-label">Photos</span>
        </Link>

        <Link to="/widgets" className={`nav-item ${activeTab === 'widgets' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
          </svg>
          <span className="nav-label">Widgets</span>
        </Link>

        <Link to="/more" className={`nav-item ${activeTab === 'more' ? 'active' : ''}`}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="nav-label">More</span>
        </Link>
      </nav>}
    </>
  );
}

export default App;
