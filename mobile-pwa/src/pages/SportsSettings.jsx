import React, { useState, useEffect } from 'react';
import './SportsSettings.css';
import AlertModal from '../components/AlertModal';
import { apiFetch } from '../api/apiClient';

export default function SportsSettings() {
  const [settings, setSettings] = useState(null);
  const [selectedSport, setSelectedSport] = useState(null);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertModal, setAlertModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsData, sportsData] = await Promise.all([
        apiFetch('/api/settings').then(r => r.json()),
        apiFetch('/api/sports').then(r => r.json())
      ]);

      setSettings(settingsData);
      setSports(sportsData);

      // Determine which sport is currently enabled
      if (settingsData.sports?.enabled) {
        setSelectedSport(settingsData.sports.sport || 'nba');
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  const handleSportSelect = async (sportId) => {
    setSaving(true);
    try {
      const response = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'sports.enabled': true,
          'sports.defaultSport': sportId,
          'sports.sport': sportId,
          'widgets.sports': true
        })
      });

      if (!response.ok) throw new Error('Failed to save');

      setSelectedSport(sportId);
      const sportName = sports.find(s => s.id === sportId)?.name || sportId;
      setAlertModal({ type: 'success', message: `${sportName} activated!` });

      // Reload settings to get updated data
      await loadData();
    } catch (error) {
      console.error('Failed to save:', error);
      setAlertModal({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Sports Settings</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page sports-settings">
      <div className="page-header">
        <h1>🏆 Sports Widget</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-icon">⚽</span>
          <h2>Choose Your Sport</h2>
        </div>
        <p className="help-text">
          Select which sport you want to display on your smart mirror
        </p>
      </div>

      <div className="sports-list">
        {sports.map(sport => (
          <div
            key={sport.id}
            className={`sport-card ${selectedSport === sport.id ? 'active' : ''}`}
            onClick={() => handleSportSelect(sport.id)}
          >
            <div className="sport-icon-large">{sport.icon}</div>
            <div className="sport-info">
              <h3>{sport.name}</h3>
              <p className="sport-description">Live scores and schedules</p>
            </div>
            {selectedSport === sport.id && (
              <div className="active-badge">✓ Active</div>
            )}
          </div>
        ))}
      </div>

      {alertModal && (
        <AlertModal
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal(null)}
        />
      )}
    </div>
  );
}
