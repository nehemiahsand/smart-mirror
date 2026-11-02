import React, { useEffect } from 'react';
import { Modal } from './NexusUI';

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

    return (
        <Modal
            title={title || (type === 'error' ? 'Action failed' : 'Nexus')}
            onClose={onClose}
        >
            <p role={type === 'error' ? 'alert' : 'status'}>{message}</p>
            <button className="primary" onClick={onClose}>
                OK
            </button>
        </Modal>
    );
}
