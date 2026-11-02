import React from 'react';
import PropTypes from 'prop-types';

const PageIndicator = ({ pages, currentPage, compact = false }) => (
    <div className={`page-indicator${compact ? ' page-indicator-compact' : ''}`}>
        {pages.map((pageId) => (
            <div
                key={pageId}
                className={`page-dot ${currentPage === pageId ? 'active' : ''}`}
            />
        ))}
    </div>
);

PageIndicator.propTypes = {
    pages: PropTypes.arrayOf(PropTypes.string).isRequired,
    currentPage: PropTypes.string.isRequired,
    compact: PropTypes.bool
};

export default PageIndicator;
