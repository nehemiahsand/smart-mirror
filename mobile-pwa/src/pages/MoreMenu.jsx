import React from 'react';
import { Link } from 'react-router-dom';
import './MoreMenu.css';

export default function MoreMenu() {
    return (
        <div className="page more-menu">
            <div className="page-header">
                <h1>📱 More</h1>
            </div>

            <div className="menu-section">
                <h2 className="section-title">Configuration</h2>

                <Link to="/wifi" className="menu-item">
                    <div className="menu-icon">📶</div>
                    <div className="menu-content">
                        <h3>WiFi Settings</h3>
                        <p>Configure network connections</p>
                    </div>
                    <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>

                <Link to="/sports" className="menu-item">
                    <div className="menu-icon">🏀</div>
                    <div className="menu-content">
                        <h3>Sports</h3>
                        <p>Choose which sports to display</p>
                    </div>
                    <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>

                <Link to="/settings" className="menu-item">
                    <div className="menu-icon">⚙️</div>
                    <div className="menu-content">
                        <h3>System Settings</h3>
                        <p>Weather, location, and display preferences</p>
                    </div>
                    <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>

            <div className="menu-section">
                <h2 className="section-title">About</h2>

                <div className="info-card">
                    <div className="info-row">
                        <span className="info-label">Smart Mirror</span>
                        <span className="info-value">v1.0.0</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">System</span>
                        <span className="info-value">Raspberry Pi</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
