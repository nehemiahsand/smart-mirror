import React from 'react';
import './StandbyMode.css';

/**
 * StandbyMode - Completely black display for minimal power consumption
 * Display is off, only WebSocket connection remains active for wake commands
 */
const StandbyMode = () => {
    return (
        <div className="standby-mode">
            {/* Completely black - no content to minimize GPU/CPU usage */}
        </div>
    );
};

export default StandbyMode;
