import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Photos.css';
import { apiFetch, getApiUrl } from '../apiClient';

/**
 * PhotosWidget - Displays rotating photos
 * @param {number} rotationInterval - Time between photos in ms (default: 10000)
 * @param {string} className - Additional CSS classes
 */
const PhotosWidget = ({
    rotationInterval = 10000,
    className = ''
}) => {
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const baseURL = getApiUrl();
                const imageApiKey = import.meta.env.VITE_API_KEY;
                const imageQuery = imageApiKey ? `?apiKey=${encodeURIComponent(imageApiKey)}` : '';
                const response = await apiFetch('/api/photos');
                const data = await response.json();

                if (data.error) {
                    console.warn('Photos not configured:', data.message);
                    setPhotos([]);
                    setLoading(false);
                    return;
                }

                if (data.photos && data.photos.length > 0) {
                    // Add base URL to photo paths
                    const photosWithFullUrls = data.photos.map(photo => ({
                        ...photo,
                        url: `${baseURL}${photo.url}${imageQuery}`
                    }));
                    setPhotos(photosWithFullUrls);
                } else {
                    setPhotos([]);
                }
                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch photos:', error);
                setPhotos([]);
                setLoading(false);
            }
        };

        fetchPhotos();
        // Refresh photos every 10 minutes
        const refreshInterval = setInterval(fetchPhotos, 10 * 60 * 1000);
        return () => clearInterval(refreshInterval);
    }, []);

    useEffect(() => {
        if (photos.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
        }, rotationInterval);

        return () => clearInterval(interval);
    }, [photos.length, rotationInterval]);

    if (loading) {
        return (
            <div className={`widget photos-widget ${className}`}>
                <div className="photo-frame">
                    <div className="photo-loading">Loading photos...</div>
                </div>
            </div>
        );
    }

    if (photos.length === 0) {
        return (
            <div className={`widget photos-widget ${className}`}>
                <div className="photo-frame">
                    <div className="photo-loading">No photos available</div>
                </div>
            </div>
        );
    }

    return (
        <div className={`widget photos-widget ${className}`}>
            <div className="photo-frame">
                <img
                    src={photos[currentPhotoIndex].url}
                    alt="Photo"
                    className="photo-image"
                    loading="lazy"
                />
            </div>
        </div>
    );
};

PhotosWidget.propTypes = {
    rotationInterval: PropTypes.number,
    className: PropTypes.string
};

export default PhotosWidget;
