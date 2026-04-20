import React, { useState, useEffect, useCallback } from 'react';
import './WidgetManager.css';
import AlertModal from '../components/AlertModal';
import { apiFetch } from '../api/apiClient';

const PAGES = [
  { id: 'home', name: 'Main Page' },
  { id: 'weather', name: 'Weather Page' },
  { id: 'sports', name: 'Sports Page' }
];

const WIDGETS_BY_PAGE = {
  home: [
    { id: 'timedate', name: 'Time & Date', icon: '🕐' },
    { id: 'weathertemp', name: 'Weather, Temp & Traffic', icon: '🌤️' },
    { id: 'googlecalendar', name: 'Calendar & Sports', icon: '📅' },
    { id: 'photos', name: 'Photos Slideshow', icon: '📸' },
  ],
  weather: [
    { id: 'timedate', name: 'Time & Date', icon: '🕐' },
    { id: 'sunmoon', name: 'Sun & Moon', icon: '🌙' },
    { id: 'temps', name: 'Outdoor & Indoor Temp', icon: '🌡️' },
    { id: 'hourly', name: 'Hourly Forecast', icon: '🕒' },
  ],
  sports: [
    { id: 'timedate', name: 'Time & Date', icon: '🕐' },
    { id: 'highlights', name: 'Warriors Highlights', icon: '🏀' },
  ],
};

export default function WidgetManager() {
  const [activePage, setActivePage] = useState('home');
  const [pageWidgets, setPageWidgets] = useState({ home: [], weather: [], sports: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertModal, setAlertModal] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    loadWidgets();
  }, []);

  const loadWidgets = async () => {
    try {
      const response = await apiFetch('/api/settings');
      const settings = await response.json();

      const homeOrder = settings.widgetOrder || [];
      const weatherOrder = settings.weatherWidgetOrder || [];
      const sportsOrder = settings.sportsWidgetOrder || [];
      const buildList = (pageId, savedOrder) => {
        const list = [...WIDGETS_BY_PAGE[pageId]];
        if (savedOrder.length > 0) {
          list.sort((a, b) => {
            const indexA = savedOrder.indexOf(a.id);
            const indexB = savedOrder.indexOf(b.id);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
        }
        return list;
      };

      setPageWidgets({
        home: buildList('home', homeOrder),
        weather: buildList('weather', weatherOrder),
        sports: buildList('sports', sportsOrder)
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to load widgets:', error);
      setLoading(false);
    }
  };

  const moveWidget = (index, direction) => {
    const list = [...pageWidgets[activePage]];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;

    [list[index], list[newIndex]] = [list[newIndex], list[index]];
    setPageWidgets(prev => ({ ...prev, [activePage]: list }));
  };

  const reorderWidgets = useCallback((fromIndex, toIndex) => {
    if (fromIndex === null || fromIndex === toIndex || toIndex < 0) {
      return;
    }

    setPageWidgets(prev => {
      const current = [...prev[activePage]];
      if (toIndex >= current.length) {
        return prev;
      }

      const [movedWidget] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, movedWidget);
      return { ...prev, [activePage]: current };
    });
  }, [activePage]);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    reorderWidgets(draggedIndex, index);
    setDraggedIndex(index);
  }, [draggedIndex, reorderWidgets]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleTouchStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.currentTarget.classList.add('dragging');
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (draggedIndex === null) {
      return;
    }

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = element?.closest('.widget-item');
    if (!target?.parentNode) {
      return;
    }

    const nextIndex = Array.from(target.parentNode.children).indexOf(target);
    if (nextIndex !== -1 && nextIndex !== draggedIndex) {
      reorderWidgets(draggedIndex, nextIndex);
      setDraggedIndex(nextIndex);
    }
  }, [draggedIndex, reorderWidgets]);

  const handleTouchEnd = useCallback((e) => {
    e.currentTarget.classList.remove('dragging');
    setDraggedIndex(null);
  }, []);

  const saveChanges = async () => {
    setSaving(true);
    try {
      const updatedSettings = {
        widgetOrder: pageWidgets.home.map(w => w.id),
        weatherWidgetOrder: pageWidgets.weather.map(w => w.id),
        sportsWidgetOrder: pageWidgets.sports.map(w => w.id)
      };

      await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      setAlertModal({ type: 'success', message: 'Widget order saved' });
      setTimeout(() => setAlertModal(null), 2000);
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

  const currentWidgets = pageWidgets[activePage];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Widgets</h1>
      </div>
      
      <div className="page-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {PAGES.map(p => (
          <button 
            key={p.id}
            onClick={() => setActivePage(p.id)}
            style={{ 
              flex: 1, 
              padding: '10px', 
              background: activePage === p.id ? 'var(--primary-color, #007bff)' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: activePage === p.id ? 'bold' : 'normal'
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-icon">📊</span>
          <h2>{PAGES.find(p => p.id === activePage)?.name} Order</h2>
        </div>

        <div className="widgets-list">
          {currentWidgets.map((widget, index) => (
            <div
              key={widget.id}
              className={`widget-item ${draggedIndex === index ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="widget-left">
                <div className="widget-drag-handle" aria-hidden="true">⋮⋮</div>
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
                    disabled={index === currentWidgets.length - 1}
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

        <p className="widget-manager-hint">Drag widgets to reorder them, then save.</p>

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
