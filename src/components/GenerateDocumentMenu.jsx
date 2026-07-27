import { useState, useRef, useEffect } from 'react';

export default function GenerateDocumentMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setOpen(o => !o)}>
        📄 Generate Document / إنشاء مستند {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60,
          background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 10,
          boxShadow: 'var(--shadow)', minWidth: 240, overflow: 'hidden',
        }}>
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { if (!item.disabled) { item.onClick(); setOpen(false); } }}
              disabled={item.disabled}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                border: 'none', borderBottom: i < items.length - 1 ? '1px solid var(--gray-100)' : 'none',
                background: '#fff', cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                color: item.disabled ? 'var(--gray-400)' : 'var(--gray-800)',
              }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
