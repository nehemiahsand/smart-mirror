import { useState, useEffect } from 'react';

// Single global interval for the entire application
let sharedTime = new Date();
const listeners = new Set();

setInterval(() => {
    sharedTime = new Date();
    listeners.forEach(listener => listener(sharedTime));
}, 1000);

export function useSharedTime() {
    const [time, setTime] = useState(sharedTime);

    useEffect(() => {
        listeners.add(setTime);
        return () => listeners.delete(setTime);
    }, []);

    return time;
}
