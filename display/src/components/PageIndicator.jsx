import React from 'react';
import PropTypes from 'prop-types';

const PageIndicator = ({ pages, currentPage }) => (
    <div className="page-indicator">
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
    currentPage: PropTypes.string.isRequired
};

export default PageIndicator;
