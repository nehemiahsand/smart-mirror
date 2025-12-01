import React, { useEffect } from 'react';
import './AlertModal.css';

/**
 * AlertModal - Reusable alert/notification dialog
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {string} type - Alert type: 'info', 'success', 'warning', 'error' (default: 'info')
 * @param {function} onClose - Callback when closed
 * @param {number} autoClose - Auto-close after milliseconds (0 = no auto-close, default: 0)
 */
export default function AlertModal({
    title,
    message,
    type = 'info',
    onClose,
    autoClose = 0
}) {
    useEffect(() => {
        if (autoClose > 0) {
            const timer = setTimeout(onClose, autoClose);
            return () => clearTimeout(timer);
        }
    }, [autoClose, onClose]);

    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className={`alert-modal ${type}`} onClick={(e) => e.stopPropagation()}>
                <div className="alert-icon">{icons[type] || icons.info}</div>
                {title && <h3>{title}</h3>}
                <p>{message}</p>
                <button className="alert-btn" onClick={onClose}>
                    OK
                </button>
            </div>
        </div>
    );
}
