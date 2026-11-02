import { useState, useRef, useEffect, useMemo } from 'react';
import { SKU_ITEMS } from '../skuData';

// Items matching a search, in file order — except an exact item-number
// match, which comes first. Matches the number or any part of the
// description, ignoring case.
export function filterSku(query) {
  const q = query.trim().toLowerCase();
  if (!q) return SKU_ITEMS;
  const hits = SKU_ITEMS.filter(it =>
    it.itemNo.toLowerCase().includes(q) || it.description.toLowerCase().includes(q));
  const exact = hits.findIndex(it => it.itemNo.toLowerCase() === q);
  return exact > 0 ? [hits[exact], ...hits.slice(0, exact), ...hits.slice(exact + 1)] : hits;
}

function SkuRow({ item, active, chosen, onPick, rowRef }) {
  return (
    <div ref={rowRef} role="option" aria-selected={active}
      className={`sku-row${active ? ' sku-row-active' : ''}${chosen ? ' sku-row-chosen' : ''}`}
      onMouseDown={e => e.preventDefault()} onClick={() => onPick(item)}>
      <span className="sku-row-no">{item.itemNo}</span>
      <span className="sku-row-desc">{item.description}</span>
      {chosen && <span className="sku-row-check">✓</span>}
    </div>
  );
}

// Keyboard + scroll handling shared by both lists.
function useListNav(items, onPick, initialIndex = 0, openKey = true) {
  const [active, setActive] = useState(initialIndex);
  const rowRefs = useRef([]);
  useEffect(() => { setActive(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0))); }, [items, initialIndex]);
  // Keep the highlighted row in view — also when a list opens or re-filters.
  useEffect(() => { rowRefs.current[active]?.scrollIntoView({ block: 'nearest' }); }, [active, items, openKey]);
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); onPick(items[active]); }
  };
  return { active, setActive, rowRefs, onKeyDown };
}

/* ── In-row combobox: shows the chosen item; click to change it ───── */
export function SkuPicker({ value, onSelect, onCreateCustom }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items = useMemo(() => filterSku(query), [query]);
  const chosenIndex = !query && value ? items.findIndex(it => it.itemNo === value) : 0;
  const pick = (item) => { onSelect(item); setQuery(''); setOpen(false); };
  const nav = useListNav(items, pick, chosenIndex, open);
  const chosen = value ? SKU_ITEMS.find(it => it.itemNo === value) : null;

  return (
    <div className="sku-picker" ref={wrapRef}>
      <input
        className="input"
        placeholder="Search item no. or description / ابحث برقم البند أو الوصف"
        value={open ? query : (chosen ? `${chosen.itemNo} — ${chosen.description}` : '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); else nav.onKeyDown(e); }}
      />
      {open && (
        <div className="sku-dropdown" role="listbox">
          <div className="sku-list">
            {items.length === 0 && <div className="sku-empty">No matching items / لا يوجد بند مطابق</div>}
            {items.map((it, i) => (
              <SkuRow key={it.itemNo} item={it} active={i === nav.active} chosen={it.itemNo === value}
                onPick={pick} rowRef={el => { nav.rowRefs.current[i] = el; }} />
            ))}
          </div>
          {onCreateCustom && (
            <div className="sku-row sku-row-custom" onMouseDown={e => e.preventDefault()}
              onClick={() => { onCreateCustom(query.trim()); setQuery(''); setOpen(false); }}>
              ＋ {query.trim() ? `Use "${query.trim()}" as a custom item` : 'Custom item'} / بند مخصص
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Side panel: the full list, always open, with search ──────────── */
export function SkuBrowser({ usedItemNos, onPick }) {
  const [query, setQuery] = useState('');
  const items = useMemo(() => filterSku(query), [query]);
  const nav = useListNav(items, onPick, 0);
  const used = useMemo(() => new Set(usedItemNos), [usedItemNos]);

  return (
    <div className="sku-browser">
      <div className="sku-browser-head">
        <div style={{ fontSize: 15, fontWeight: 700 }}>Approved Items / قائمة البنود</div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
          {query.trim() ? `${items.length} of ${SKU_ITEMS.length}` : `${SKU_ITEMS.length} items`} · click to add / اضغط للإضافة
        </div>
        <input className="input mt8" type="search" value={query}
          placeholder="Search item no. or description / ابحث برقم البند أو الوصف"
          onChange={e => setQuery(e.target.value)} onKeyDown={nav.onKeyDown} />
      </div>
      <div className="sku-list sku-browser-list" role="listbox">
        {items.length === 0 && <div className="sku-empty">No matching items / لا يوجد بند مطابق</div>}
        {items.map((it, i) => (
          <SkuRow key={it.itemNo} item={it} active={!!query.trim() && i === nav.active} chosen={used.has(it.itemNo)}
            onPick={onPick} rowRef={el => { nav.rowRefs.current[i] = el; }} />
        ))}
      </div>
    </div>
  );
}
