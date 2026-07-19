import { useState, useRef, useEffect, useMemo } from 'react';
import { BOQ_ITEMS, BOQ_CATEGORIES } from '../boqData';

// Searchable, grouped BOQ item combobox. Filters by item number, description,
// category, or unit; groups results by category; calls onSelect(item) on pick.
export default function BoqItemPicker({ value, onSelect, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = !q ? BOQ_ITEMS : BOQ_ITEMS.filter(it =>
      it.itemNo.toLowerCase().includes(q) ||
      it.description.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q) ||
      it.unit.toLowerCase().includes(q)
    );
    const byCat = {};
    for (const it of matches) (byCat[it.category] ||= []).push(it);
    return BOQ_CATEGORIES
      .filter(c => byCat[c]?.length)
      .map(c => ({ category: c, items: byCat[c] }));
  }, [query]);

  const pick = (item) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="dn-picker" ref={wrapRef}>
      <input
        className="input"
        placeholder={placeholder || 'Search item no, description, category, unit...'}
        value={open ? query : (value || '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
      />
      {open && (
        <div className="dn-picker-list">
          {grouped.length === 0 && (
            <div className="dn-picker-empty">No matching BOQ items</div>
          )}
          {grouped.map(g => (
            <div key={g.category}>
              <div className="dn-picker-group">{g.category}</div>
              {g.items.map(it => (
                <div key={it.itemNo} className="dn-picker-item" onClick={() => pick(it)}>
                  <span className="dn-picker-item-no">{it.itemNo}</span>
                  <span className="dn-picker-item-desc">{it.description}</span>
                  <span className="dn-picker-item-unit">{it.unit}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
