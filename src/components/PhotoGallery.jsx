import { useState, useRef } from 'react';
import { photoSrc, photoCaption } from '../storage';
import PhotoLightbox from './PhotoLightbox';

/*
 * Reusable before/progress/after photo section: upload (click or drag-drop),
 * per-photo caption, delete, reorder (move left/right), and a full-screen
 * lightbox with download. `photos` is the normalized {url, caption}[] shape
 * from storage.js — normalizePhotos handles old plain-string rows upstream.
 */
export default function PhotoGallery({
  title, titleAr, photos = [], editable = false, uploading = false,
  onUpload, onDelete, onReorder, onCaptionChange,
  collapsible = false, defaultCollapsed = false,
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const fileRef = useRef();

  const handleFiles = (files) => {
    if (files?.length && onUpload) onUpload(Array.from(files));
  };

  return (
    <div>
      <div className="section-title" style={{ justifyContent: 'space-between', cursor: collapsible ? 'pointer' : 'default' }}
        onClick={collapsible ? () => setCollapsed(c => !c) : undefined}>
        <span>
          {collapsible && (collapsed ? '▸ ' : '▾ ')}
          {title} {titleAr && <span>/ {titleAr}</span>} {photos.length > 0 && `(${photos.length})`}
        </span>
        {editable && !collapsed && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            disabled={uploading}
            style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            {uploading ? '⏳' : '📷 Add / إضافة'}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {editable && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#3B82F6' : '#CBD5E1'}`,
                  background: dragOver ? '#EFF6FF' : '#F8FAFC',
                  borderRadius: 10, padding: '10px 14px', textAlign: 'center',
                  fontSize: 12, color: '#64748B', cursor: 'pointer', marginBottom: 10,
                }}>
                {uploading ? 'Uploading… / جاري الرفع...' : 'Drag photos here or click to add / اسحب الصور هنا أو اضغط للإضافة'}
              </div>
            </>
          )}

          {photos.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>No photos yet / لا توجد صور</div>
          ) : (
            <div className="photo-grid">
              {photos.map((p, i) => (
                <div key={i} className="photo-thumb-wrap">
                  <div className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightboxIndex(i)}>
                    <img src={photoSrc(p)} alt="" decoding="async" />
                    {editable && (
                      <button className="photo-remove" onClick={e => { e.stopPropagation(); onDelete?.(i); }}>✕</button>
                    )}
                  </div>
                  {editable && (
                    <div className="photo-thumb-controls">
                      <button type="button" className="dn-icon-btn" disabled={i === 0}
                        onClick={() => onReorder?.(i, i - 1)} title="Move left / نقل لليسار">◀</button>
                      <input
                        className="photo-caption-input"
                        placeholder="Caption / تعليق"
                        defaultValue={photoCaption(p)}
                        onBlur={e => onCaptionChange?.(i, e.target.value)}
                      />
                      <button type="button" className="dn-icon-btn" disabled={i === photos.length - 1}
                        onClick={() => onReorder?.(i, i + 1)} title="Move right / نقل لليمين">▶</button>
                    </div>
                  )}
                  {!editable && photoCaption(p) && (
                    <div className="photo-caption-readonly">{photoCaption(p)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox photos={photos} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
