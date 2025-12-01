import React from 'react';

const MessageOverlay = ({ message }) => {
    if (!message) return null;

    return (
        <div className={`message-overlay ${message.priority === 'high' ? 'priority-high' : ''}`}>
            <div className="message-text">{message.message}</div>
        </div>
    );
};

export default MessageOverlay;
