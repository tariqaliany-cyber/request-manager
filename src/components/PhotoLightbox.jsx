import { useState, useEffect } from 'react';
import { photoSrc, photoCaption } from '../storage';

export default function PhotoLightbox({ photos, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  setIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex(i => Math.min(photos.length - 1, i + 1));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [photos.length, onClose]);

  const prev = (e) => { e.stopPropagation(); setIndex(i => Math.max(0, i - 1)); };
  const next = (e) => { e.stopPropagation(); setIndex(i => Math.min(photos.length - 1, i + 1)); };

  const current = photos[index];
  const caption = photoCaption(current);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed', top: 16, right: 16,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000,
        }}>
        ×
      </button>

      {/* Download button */}
      <a
        href={photoSrc(current)}
        download={`photo-${index + 1}.jpg`}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: 16, right: 66,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', fontSize: 17, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, textDecoration: 'none',
        }}>
        ⬇
      </a>

      {/* Counter */}
      {photos.length > 1 && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.7)', fontSize: 13, zIndex: 10000,
        }}>
          {index + 1} / {photos.length}
        </div>
      )}

      {/* Image container */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Prev */}
        {photos.length > 1 && (
          <button onClick={prev} disabled={index === 0} style={{
            width: 40, height: 40, borderRadius: '50%',
            background: index === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
            border: 'none', color: '#fff', fontSize: 24, cursor: index === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>‹</button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img
            src={photoSrc(current)}
            alt=""
            style={{
              maxWidth: 'min(85vw, 900px)',
              maxHeight: '76vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              display: 'block',
            }}
          />
          {caption && (
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', maxWidth: '80vw' }}>
              {caption}
            </div>
          )}
        </div>

        {/* Next */}
        {photos.length > 1 && (
          <button onClick={next} disabled={index === photos.length - 1} style={{
            width: 40, height: 40, borderRadius: '50%',
            background: index === photos.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
            border: 'none', color: '#fff', fontSize: 24,
            cursor: index === photos.length - 1 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>›</button>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6, zIndex: 10000,
          }}>
          {photos.map((p, i) => (
            <img
              key={i}
              src={photoSrc(p)}
              onClick={() => setIndex(i)}
              alt=""
              style={{
                width: 44, height: 44, objectFit: 'cover', borderRadius: 6,
                cursor: 'pointer', opacity: i === index ? 1 : 0.45,
                border: i === index ? '2px solid #fff' : '2px solid transparent',
                transition: 'opacity .15s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
