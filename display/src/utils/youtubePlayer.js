let pending;

export function loadYouTubePlayer() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady;
        const script = document.createElement('script');
        let timer;
        const restore = () => {
            clearTimeout(timer);
            if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
        };
        const fail = () => {
            restore(); script.remove(); pending = null;
            reject(new Error('YouTube could not connect. Check the mirror’s network or content blocker.'));
        };
        const ready = () => {
            restore();
            if (window.YT?.Player) resolve(window.YT);
            else fail();
            if (typeof previous === 'function') previous();
        };
        window.onYouTubeIframeAPIReady = ready;
        script.src = 'https://www.youtube.com/iframe_api';
        script.onerror = fail;
        timer = setTimeout(fail, 15000);
        document.head.appendChild(script);
    });
    return pending;
}
