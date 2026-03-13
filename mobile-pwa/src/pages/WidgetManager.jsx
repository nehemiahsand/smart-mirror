import React, { useState, useEffect } from 'react';
import './WidgetManager.css';
import AlertModal from '../components/AlertModal';
import { apiFetch } from '../apiClient';

const WIDGETS = [
  { id: 'timedate', name: 'Time & Date', icon: '🕐' },
  { id: 'weathertemp', name: 'Weather & Temperature & Traffic', icon: '🌤️' },
  { id: 'googlecalendar', name: 'Calendar & Sports', icon: '📅' },
  { id: 'photos', name: 'Photos Slideshow', icon: '📸' },
];

export default function WidgetManager() {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertModal, setAlertModal] = useState(null);

  useEffect(() => {
    loadWidgets();
  }, []);

  const loadWidgets = async () => {
    try {
      const response = await apiFetch('/api/settings');
      const settings = await response.json();

      const widgetOrder = settings.widgetOrder || [];

      const list = [...WIDGETS];

      if (widgetOrder.length > 0) {
        list.sort((a, b) => {
          const indexA = widgetOrder.indexOf(a.id);
          const indexB = widgetOrder.indexOf(b.id);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      setWidgets(list);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load widgets:', error);
      setLoading(false);
    }
  };

  const moveWidget = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= widgets.length) return;

    const newList = [...widgets];
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    setWidgets(newList);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const updatedSettings = {
        widgetOrder: widgets.map(w => w.id),
      };

      await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
    } catch (error) {
      console.error('Failed to save:', error);
      setAlertModal({ type: 'error', message: 'Failed to save order' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Widget Manager</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Widgets</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-icon">📊</span>
          <h2>Widget Order</h2>
        </div>

        <div className="widgets-list">
          {widgets.map((widget, index) => (
            <div key={widget.id} className="widget-item">
              <div className="widget-left">
                <div className="order-controls">
                  <button
                    className="order-btn"
                    onClick={() => moveWidget(index, 'up')}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="order-btn"
                    onClick={() => moveWidget(index, 'down')}
                    disabled={index === widgets.length - 1}
                  >
                    ↓
                  </button>
                </div>
                <span className="widget-icon">{widget.icon}</span>
                <span className="widget-name">{widget.name}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          className="save-btn"
          onClick={saveChanges}
          disabled={saving}
        >
          {saving ? '⟳ Saving...' : '💾 Save Changes'}
        </button>
      </div>

      {/* Alert Modal */}
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
