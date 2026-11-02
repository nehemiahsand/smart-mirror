import { Button } from '../components/NexusUI';
import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Minus,
    Plus,
    Shuffle,
    Trash2,
    Upload
} from 'lucide-react';
import { apiFetch, getApiBase } from '../api/apiClient';
import { useNexus } from '../state/NexusProvider';
import { Confirmation, Modal, Notice } from '../components/NexusUI';

export default function Photos() {
    const { data, request, refresh } = useNexus();
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [selected, setSelected] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const dragged = useRef(null);
    const interval = data.settings?.photos?.interval || 10;
    const photo = photos.find((p) => p.id === selected);
    const index = photos.findIndex((p) => p.id === selected);
    async function load() {
        const result = await request('/api/photos');
        setPhotos(result.photos || []);
    }
    useEffect(() => {
        let active = true;
        request('/api/photos')
            .then((result) => {
                if (active) setPhotos(result.photos || []);
            })
            .catch((e) => {
                if (active) setError(e.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [request]);
    async function reorder(next) {
        setBusy(true);
        setError('');
        try {
            await request('/api/photos/reorder', {
                photoIds: next.map((p) => p.id)
            });
            setPhotos(next);
            setMessage('Photo order saved.');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }
    function move(from, to) {
        if (to < 0 || to >= photos.length || from === to) return;
        const next = [...photos];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        reorder(next);
    }
    function shuffle() {
        const next = [...photos];
        for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [next[i], next[j]] = [next[j], next[i]];
        }
        reorder(next);
    }
    async function upload(files) {
        setBusy(true);
        setError('');
        setMessage('');
        let succeeded = 0;
        let failed = 0;
        for (const file of files) {
            try {
                const form = new FormData();
                form.append('photo', file);
                const response = await apiFetch('/api/photos', {
                    method: 'POST',
                    body: form
                });
                if (!response.ok) throw new Error('Upload rejected');
                succeeded++;
            } catch (_) {
                failed++;
            }
        }
        try {
            await load();
        } catch (e) {
            setError(e.message);
        }
        if (failed)
            setError(`${succeeded} uploaded; ${failed} could not be uploaded.`);
        else
            setMessage(
                `${succeeded} photo${succeeded === 1 ? '' : 's'} uploaded.`
            );
        setBusy(false);
    }
    async function changeInterval(next) {
        setBusy(true);
        setError('');
        try {
            await request('/api/nexus/preferences', {
                'photos.interval': next
            });
            await refresh('settings');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }
    async function remove() {
        setBusy(true);
        setError('');
        try {
            await request(`/api/photos/${deleting}`, undefined, {
                method: 'DELETE'
            });
            setPhotos((previous) => previous.filter((p) => p.id !== deleting));
            setDeleting(null);
            setMessage('Photo deleted.');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <div className="row">
                <h2>Photo library</h2>
                <label className={`button ${busy ? 'upload-disabled' : ''}`}>
                    <Upload /> Upload
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        disabled={busy}
                        hidden
                        onChange={(e) => {
                            upload(Array.from(e.target.files || []));
                            e.target.value = '';
                        }}
                    />
                </label>
            </div>
            <section className="surface section-title">
                <div className="row">
                    <div>
                        <span className="eyebrow">Slideshow interval</span>
                        <small>{photos.length} photos</small>
                    </div>
                    <div className="button-row">
                        <Button
                            className="icon-button"
                            aria-label="Decrease slideshow interval"
                            disabled={busy || interval <= 2}
                            onClick={() => changeInterval(interval - 1)}
                        >
                            <Minus />
                        </Button>
                        <span className="mono">{interval}s</span>
                        <Button
                            className="icon-button"
                            aria-label="Increase slideshow interval"
                            disabled={busy || interval >= 60}
                            onClick={() => changeInterval(interval + 1)}
                        >
                            <Plus />
                        </Button>
                    </div>
                </div>
                <Button
                    className="section-title"
                    onClick={shuffle}
                    disabled={busy || photos.length < 2}
                >
                    <Shuffle /> Shuffle
                </Button>
            </section>
            {loading ? (
                <p>Loading photos…</p>
            ) : photos.length ? (
                <div className="nexus-photo-grid">
                    {photos.map((photo, i) => (
                        <Button
                            key={photo.id}
                            className="nexus-photo"
                            disabled={busy}
                            draggable={!busy}
                            onDragStart={() => {
                                dragged.current = i;
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (dragged.current !== null)
                                    move(dragged.current, i);
                                dragged.current = null;
                            }}
                            onDragEnd={() => {
                                dragged.current = null;
                            }}
                            onClick={() => setSelected(photo.id)}
                            aria-label={`Preview photo ${i + 1}`}
                        >
                            <img
                                loading="lazy"
                                src={`${getApiBase()}${photo.thumbnailUrl || photo.url}`}
                                alt={photo.caption || `Photo ${i + 1}`}
                            />
                            <span className="mono">#{i + 1}</span>
                        </Button>
                    ))}
                </div>
            ) : (
                <p className="hint">
                    Upload photos to start your mirror slideshow.
                </p>
            )}
            <Notice error={error} message={message} />
            {photo && (
                <Modal title="Photo preview" onClose={() => setSelected(null)}>
                    <img
                        className="photo-preview"
                        src={`${getApiBase()}${photo.url}`}
                        alt={photo.caption || 'Selected photo'}
                    />
                    <p className="hint">
                        Position {index + 1} of {photos.length}
                    </p>
                    <div className="button-row">
                        <Button
                            disabled={busy || index === 0}
                            onClick={() => move(index, index - 1)}
                        >
                            <ArrowLeft /> Earlier
                        </Button>
                        <Button
                            disabled={busy || index === photos.length - 1}
                            onClick={() => move(index, index + 1)}
                        >
                            Later <ArrowRight />
                        </Button>
                        <Button
                            className="danger"
                            disabled={busy}
                            onClick={() => {
                                setSelected(null);
                                setDeleting(photo.id);
                            }}
                        >
                            <Trash2 /> Delete
                        </Button>
                    </div>
                    <Notice error={error} />
                </Modal>
            )}
            {deleting !== null && (
                <Confirmation
                    title="Delete photo?"
                    text="This removes the photo from your mirror library."
                    busy={busy}
                    onClose={() => setDeleting(null)}
                    onConfirm={remove}
                />
            )}
        </>
    );
}
