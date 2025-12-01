import React from 'react';
import './ConfirmModal.css';

/**
 * ConfirmModal - Reusable confirmation dialog
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {function} onConfirm - Callback when confirmed
 * @param {function} onCancel - Callback when cancelled
 * @param {boolean} danger - Whether this is a dangerous action (red confirm button)
 */
export default function ConfirmModal({
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    danger = false
}) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="modal-buttons">
                    <button className="modal-btn cancel" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        className={`modal-btn confirm ${danger ? 'danger' : ''}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
