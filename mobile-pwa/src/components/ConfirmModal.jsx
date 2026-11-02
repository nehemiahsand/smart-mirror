import React from 'react';
import { Modal } from './NexusUI';

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
        <Modal title={title} onClose={onCancel}>
            <p>{message}</p>
            <div className="button-row">
                <button onClick={onCancel}>{cancelText}</button>
                <button
                    className={danger ? 'danger' : 'primary'}
                    onClick={onConfirm}
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
}
