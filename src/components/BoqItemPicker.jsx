import { useState, useRef, useEffect, useMemo } from 'react';
import { BOQ_ITEMS, BOQ_CATEGORIES } from '../boqData';

// Searchable, grouped BOQ item combobox. Filters by item number, description,
// category, or unit; groups results by category; calls onSelect(item) on pick.
// Also merges in any saved BOQ Library items, and offers to create a custom
// item (either a generic "Add Custom Item" option, or — when the typed text
// doesn't match anything — "Create '<text>' as a custom item").
export default function BoqItemPicker({ value, onSelect, onCreateCustom, libraryItems, placeholder }) {
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

  const allItems = useMemo(() => [...BOQ_ITEMS, ...(libraryItems || [])], [libraryItems]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = !q ? allItems : allItems.filter(it =>
      it.itemNo.toLowerCase().includes(q) ||
      it.description.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q) ||
      it.unit.toLowerCase().includes(q)
    );
    const byCat = {};
    for (const it of matches) (byCat[it.category] ||= []).push(it);
    const extraCats = Object.keys(byCat).filter(c => !BOQ_CATEGORIES.includes(c));
    return [...BOQ_CATEGORIES, ...extraCats]
      .filter(c => byCat[c]?.length)
      .map(c => ({ category: c, items: byCat[c] }));
  }, [query, allItems]);

  const pick = (item) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  const createCustom = (prefillName) => {
    onCreateCustom?.(prefillName);
    setQuery('');
    setOpen(false);
  };

  const trimmedQuery = query.trim();

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
              {g.items.map((it, i) => (
                <div key={g.category + '-' + it.itemNo + '-' + i} className="dn-picker-item" onClick={() => pick(it)}>
                  <span className="dn-picker-item-no">{it.itemNo}</span>
                  <span className="dn-picker-item-desc">{it.description}</span>
                  <span className="dn-picker-item-unit">{it.unit}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="dn-picker-custom">
            {trimmedQuery && (
              <div className="dn-picker-item dn-picker-item-custom" onClick={() => createCustom(trimmedQuery)}>
                Create "{trimmedQuery}" as a custom item / إنشاء "{trimmedQuery}" كبند مخصص
              </div>
            )}
            <div className="dn-picker-item dn-picker-item-custom" onClick={() => createCustom('')}>
              ＋ Add Custom Item / إضافة بند مخصص
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
