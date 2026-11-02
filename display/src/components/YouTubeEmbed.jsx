import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { loadYouTubePlayer } from '../utils/youtubePlayer';

let playerSequence = 0;

const errors = {
    2: 'This highlight has an invalid video identifier.',
    5: 'YouTube could not play this highlight in the mirror’s browser.',
    100: 'This highlight was removed or made private.',
    101: 'The publisher does not allow this highlight to play on other websites.',
    150: 'The publisher does not allow this highlight to play on other websites.',
    153: 'YouTube could not identify the mirror’s website. Check its referrer policy.'
};

export default function YouTubeEmbed({ videoId, title, onPlaying, onFailure }) {
    const host = useRef(null);
    const callbacks = useRef({ onPlaying, onFailure });
    callbacks.current = { onPlaying, onFailure };
    const [blocked, setBlocked] = useState(false);
    const playerRef = useRef(null);
    useEffect(() => {
        let stopped = false;
        let failed = false;
        let player;
        const fail = (code, message) => {
            if (stopped || failed) return;
            failed = true; clearTimeout(timeout);
            callbacks.current.onFailure({ code, message });
        };
        // An iframe load event only confirms the HTML loaded, not video playback.
        const timeout = setTimeout(() => fail('timeout', 'Playback status is unavailable. The video may still load; retry if it remains blank.'), 25000);
        setBlocked(false);
        // Start the normal embed immediately. Loading the diagnostics SDK must
        // never become an additional prerequisite for a working video.
        const target = document.createElement('iframe');
        target.id = `nexus-youtube-${++playerSequence}`;
        target.title = title || 'Team highlights';
        target.referrerPolicy = 'strict-origin-when-cross-origin';
        target.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
        target.allowFullscreen = true;
        const params = new URLSearchParams({ enablejsapi: '1', autoplay: '1', mute: '1', controls: '0', playsinline: '1', rel: '0', loop: '1', playlist: videoId, origin: window.location.origin });
        target.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`;
        host.current.replaceChildren(target);
        loadYouTubePlayer().then((YT) => {
            if (stopped) return;
            player = new YT.Player(target.id, {
                width: '100%', height: '100%', videoId,
                playerVars: { autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0, loop: 1, playlist: videoId, origin: window.location.origin },
                events: {
                    onReady: ({ target }) => {
                        if (stopped) return;
                        const iframe = target.getIframe();
                        iframe.title = title || 'Team highlights';
                        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                        target.mute(); target.playVideo();
                    },
                    onStateChange: ({ data }) => {
                        if (stopped || failed) return;
                        if (data === 1) { clearTimeout(timeout); setBlocked(false); callbacks.current.onPlaying(); }
                    },
                    onAutoplayBlocked: () => {
                        if (!stopped) { clearTimeout(timeout); setBlocked(true); }
                    },
                    onError: ({ data }) => fail(data, errors[data] || `YouTube playback failed (code ${data}).`)
                }
            });
            playerRef.current = player;
        }).catch(() => fail('connection', 'YouTube playback status could not connect. The video may still play; retry if it remains blank.'));
        return () => {
            stopped = true; clearTimeout(timeout); playerRef.current = null;
            player?.destroy();
        };
    }, [videoId]);
    return <><div className="fun-youtube-player" ref={host} />{blocked && <button className="fun-player-action fun-player-overlay" onClick={() => playerRef.current?.playVideo()}>Play highlights</button>}</>;
}
YouTubeEmbed.propTypes = { videoId: PropTypes.string.isRequired, title: PropTypes.string, onPlaying: PropTypes.func.isRequired, onFailure: PropTypes.func.isRequired };
