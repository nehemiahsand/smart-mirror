import React from 'react';

const StatusIndicator = ({ isConnected }) => {
    return (
        <div className="status-indicator">
            <div className={`status-dot ${isConnected ? '' : 'disconnected'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
    );
};

export default StatusIndicator;
