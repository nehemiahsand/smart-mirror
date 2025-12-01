import React, { useState, useEffect } from 'react';
import './Photos.css';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';

const API_BASE = `http://${window.location.hostname}:3001`;

export default function Photos() {
  const [photos, setPhotos] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [alertModal, setAlertModal] = useState(null);

  useEffect(() => {
    fetchPhotos();
    fetchSettings();
  }, []);

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/photos`);
      const data = await response.json();
      setPhotos(data.photos || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch photos:', error);
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/settings`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    let uploadedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      const formData = new FormData();
      formData.append('photo', file);

      try {
        const response = await fetch(`${API_BASE}/api/photos`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          uploadedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error('Upload error:', error);
        failedCount++;
      }
    }

    await fetchPhotos();

    if (failedCount === 0) {
      setAlertModal({ type: 'success', message: `${uploadedCount} photo(s) uploaded successfully!` });
    } else {
      setAlertModal({ type: 'warning', message: `Uploaded ${uploadedCount}, Failed ${failedCount}` });
    }

    e.target.value = '';
  };

  const confirmDelete = (photoId) => {
    setConfirmModal({
      message: 'Delete this photo? This cannot be undone.',
      onConfirm: () => handleDelete(photoId),
      danger: true
    });
  };

  const handleDelete = async (photoId) => {
    setConfirmModal(null);

    try {
      const response = await fetch(`${API_BASE}/api/photos/${photoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
        setSelectedPhoto(null);
        setAlertModal({ type: 'success', message: 'Photo deleted successfully!' });
      } else {
        const error = await response.json();
        setAlertModal({ type: 'error', message: `Delete failed: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setAlertModal({ type: 'error', message: 'Delete failed' });
    }
  };

  const updateInterval = async (newInterval) => {
    try {
      const response = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'photos.interval': newInterval
        })
      });
      if (response.ok) {
        setSettings(prev => ({
          ...prev,
          photos: {
            ...prev.photos,
            interval: newInterval
          }
        }));
      }
    } catch (error) {
      console.error('Failed to update interval:', error);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder array
    const newPhotos = [...photos];
    const draggedPhoto = newPhotos[draggedIndex];
    newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(index, 0, draggedPhoto);

    setPhotos(newPhotos);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex !== null) {
      await saveOrder();
    }
    setDraggedIndex(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e, index) => {
    const card = e.currentTarget;
    card.style.opacity = '0.8';
    card.style.transform = 'scale(0.98)';
    setDraggedIndex(index);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e, index) => {
    if (draggedIndex === null) return;

    const touch = e.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    // Find which card is under the touch point
    const cards = document.querySelectorAll('.photo-card');
    let targetIndex = -1;

    cards.forEach((card, idx) => {
      const rect = card.getBoundingClientRect();
      if (
        touchX >= rect.left &&
        touchX <= rect.right &&
        touchY >= rect.top &&
        touchY <= rect.bottom
      ) {
        targetIndex = idx;
      }
    });

    // If we found a valid target and it's different from current position
    if (targetIndex !== -1 && targetIndex !== draggedIndex) {
      const newPhotos = [...photos];
      const draggedPhoto = newPhotos[draggedIndex];
      newPhotos.splice(draggedIndex, 1);
      newPhotos.splice(targetIndex, 0, draggedPhoto);
      setPhotos(newPhotos);
      setDraggedIndex(targetIndex);
    }
  };

  const handleTouchEnd = async (e) => {
    const card = e.currentTarget;
    card.style.opacity = '';
    card.style.transform = '';
    if (draggedIndex !== null) {
      await saveOrder();
    }
    setDraggedIndex(null);
    setTouchStartY(null);
  };

  const saveOrder = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/photos/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: photos.map(p => p.id)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        setAlertModal({ type: 'error', message: `Failed to save order: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Save order error:', error);
      setAlertModal({ type: 'error', message: 'Failed to save order' });
    }
  };

  const openModal = (photo) => {
    setSelectedPhoto(photo);
  };

  const interval = settings?.photos?.interval || 10;

  if (loading) {
    return (
      <div className="photos-page">
        <div className="page-header">
          <h1>Photos</h1>
        </div>
        <div className="loading">Loading photos</div>
      </div>
    );
  }

  return (
    <div className="photos-page">
      <div className="page-header">
        <h1>Photos</h1>
        <label className="upload-btn">
          📤 Upload
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="controls-grid">
          {/* Slideshow Interval */}
          <div className="control-item">
            <label>Slideshow Interval</label>
            <div className="interval-control">
              <button
                className="interval-btn"
                onClick={() => updateInterval(Math.max(2, interval - 1))}
              >
                −
              </button>
              <span className="interval-value">{interval}s</span>
              <button
                className="interval-btn"
                onClick={() => updateInterval(Math.min(60, interval + 1))}
              >
                +
              </button>
            </div>
          </div>

          {/* Photo Count */}
          <div className="control-item">
            <label>Total Photos</label>
            <div className="photo-count">{photos.length}</div>
          </div>
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📸</span>
          <p>No photos yet</p>
          <p className="empty-hint">Upload some photos to get started</p>
        </div>
      ) : (
        <div className="photos-grid">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className={`photo-card ${draggedIndex === index ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={(e) => handleTouchMove(e, index)}
              onTouchEnd={handleTouchEnd}
              onClick={() => openModal(photo)}
            >
              <img
                src={`${API_BASE}/api/photos/image/${photo.filename}`}
                alt="Photo"
              />
              <div className="photo-overlay">
                <div className="photo-controls">
                  <span className="photo-index">#{index + 1}</span>
                  <span className="drag-handle">⋮⋮</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPhoto(null)}>
              ×
            </button>
            <img
              className="modal-image"
              src={`${API_BASE}/api/photos/image/${selectedPhoto.filename}`}
              alt="Photo preview"
            />
            <div className="modal-details">
              <button
                className="delete-btn"
                onClick={() => confirmDelete(selectedPhoto.id)}
              >
                🗑️ Delete Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          title="Confirm Action"
          message={confirmModal.message}
          confirmText="Delete"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          danger={confirmModal.danger}
        />
      )}

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
