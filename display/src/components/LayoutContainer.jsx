import React from 'react';
import PropTypes from 'prop-types';
import './LayoutContainer.css';

/**
 * LayoutContainer - Positions widgets using absolute positioning
 * @param {Object} widgetStyle - CSS style object from layout engine
 * @param {ReactNode} children - Widget component to render
 * @param {string} className - Additional CSS classes
 */
const LayoutContainer = ({ widgetStyle, children, className = '' }) => {
    return (
        <div
            className={`layout-container ${className}`}
            style={widgetStyle}
        >
            {children}
        </div>
    );
};

LayoutContainer.propTypes = {
    widgetStyle: PropTypes.object.isRequired,
    children: PropTypes.node.isRequired,
    className: PropTypes.string
};

export default LayoutContainer;
