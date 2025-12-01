import { useState, useEffect } from 'react';

/**
 * Default layout configuration
 * Each widget has x, y coordinates and enabled state
 */
const DEFAULT_LAYOUT = {
  clock: { x: 50, y: 10, enabled: true },
  date: { x: 10, y: 10, enabled: true },
  weather: { x: 85, y: 10, enabled: true },
  temperature: { x: 10, y: 45, enabled: true },
  news: { x: 85, y: 45, enabled: true },
  joke: { x: 10, y: 85, enabled: true },
  sports: { x: 85, y: 85, enabled: true }
};

/**
 * useLayoutEngine - Manages widget positioning and animations
 * @param {Object} settings - Settings object from WebSocket
 * @returns {Object} Layout configuration and utilities
 */
export const useLayoutEngine = (settings) => {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (settings?.layout?.widgets) {
      setIsAnimating(true);
      
      // Merge incoming layout with defaults
      const newLayout = { ...DEFAULT_LAYOUT };
      
      Object.keys(settings.layout.widgets).forEach(widgetName => {
        const widgetConfig = settings.layout.widgets[widgetName];
        
        if (widgetConfig) {
          newLayout[widgetName] = {
            x: widgetConfig.x ?? DEFAULT_LAYOUT[widgetName]?.x ?? 50,
            y: widgetConfig.y ?? DEFAULT_LAYOUT[widgetName]?.y ?? 50,
            enabled: widgetConfig.enabled ?? DEFAULT_LAYOUT[widgetName]?.enabled ?? true
          };
        }
      });
      
      setLayout(newLayout);
      
      // Reset animation flag after transition completes
      setTimeout(() => setIsAnimating(false), 800);
    }
  }, [settings?.layout?.widgets]);

  /**
   * Get position style for a widget
   * @param {string} widgetName - Name of the widget
   * @returns {Object} CSS style object with position
   */
  const getWidgetStyle = (widgetName) => {
    const config = layout[widgetName] || { x: 50, y: 50, enabled: true };
    
    return {
      position: 'absolute',
      left: `${config.x}%`,
      top: `${config.y}%`,
      transform: 'translate(-50%, -50%)',
      transition: isAnimating ? 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
      opacity: config.enabled ? 1 : 0,
      pointerEvents: config.enabled ? 'auto' : 'none'
    };
  };

  /**
   * Check if a widget should be displayed
   * @param {string} widgetName - Name of the widget
   * @returns {boolean}
   */
  const isWidgetEnabled = (widgetName) => {
    return layout[widgetName]?.enabled ?? true;
  };

  /**
   * Get widget position (x, y coordinates)
   * @param {string} widgetName - Name of the widget
   * @returns {Object} { x, y }
   */
  const getWidgetPosition = (widgetName) => {
    const config = layout[widgetName] || { x: 50, y: 50 };
    return { x: config.x, y: config.y };
  };

  return {
    layout,
    getWidgetStyle,
    isWidgetEnabled,
    getWidgetPosition,
    isAnimating
  };
};
