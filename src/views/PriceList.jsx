import { useState, useEffect, useMemo, useRef } from 'react';
import { PRICE_LISTS, fetchPriceListItems } from '../priceListApi';
import { canAccessPriceList } from '../storage';

const CARDS = [
  { key: 'hvac', ...PRICE_LISTS.hvac, lists: ['hvac'] },
  { key: 'mep',  ...PRICE_LISTS.mep,  lists: ['mep'] },
  { key: 'signs', title: 'Signages', titleAr: 'اللوحات الإعلانية', icon: '🪧', source: 'Project Signages · Maintenance Signages', lists: ['proj_signs', 'maint_signs'] },
];

export const sar = (n) => 'SAR ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cleanQty = (v) => { const n = parseFloat(v); return isNaN(n) || n < 0 ? 0 : Math.round(n * 1000) / 1000; };

/* ── Root ───────────────────────────────────────── */
export default function PriceList({ user, onLogout }) {
  const [card, setCard] = useState(null);
  // Selections live here so each price list keeps its own, fully separate cart.
  const [carts, setCarts] = useState({});   // { listKey: { itemId: qty } }

  // Defence in depth: the parent already gates this, never render otherwise.
  if (!canAccessPriceList(user)) return null;

  const setCart = (listKey, updater) =>
    setCarts(prev => ({ ...prev, [listKey]: updater(prev[listKey] || {}) }));

  if (!card) {
    return (
      <div className="pl-wrap">
        <div className="pl-intro">Select a price list / اختر قائمة الأسعار</div>
        <div className="pl-cards">
          {CARDS.map(c => (
            <button key={c.key} className="pl-card" onClick={() => setCard(c)}>
              <span className="pl-card-icon">{c.icon}</span>
              <span className="pl-card-title">{c.title}</span>
              <span className="pl-card-ar">{c.titleAr}</span>
              <span className="pl-card-src">{c.source}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ListView
      card={card}
      carts={carts}
      setCart={setCart}
      onBack={() => setCard(null)}
      onLogout={onLogout}
    />
  );
}

/* ── One card: (optionally two tabs) + search + selection ── */
function ListView({ card, carts, setCart, onBack, onLogout }) {
  const [listKey, setListKey] = useState(card.lists[0]);
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, items: [] });
    setQuery(''); setSection(''); setOnlySelected(false); setShowSummary(false);
    fetchPriceListItems(listKey).then(r => alive && setState({ loading: false, error: r.error, items: r.items }));
    return () => { alive = false; };
  }, [listKey]);

  const cart = carts[listKey] || {};
  const { items } = state;

  const sections = useMemo(() => [...new Set(items.map(i => i.section).filter(Boolean))], [items]);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(i => {
      if (section && i.section !== section) return false;
      if (onlySelected && !(i.id in cart)) return false;
      if (!words.length) return true;
      const hay = [i.itemNo, i.description, i.descriptionAr, i.category, i.section, i.parentDescription, i.sizeSpec, i.unit, String(i.price), i.price.toFixed(2)]
        .join(' ').toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [items, query, section, onlySelected, cart]);

  const selected = useMemo(() => items.filter(i => i.id in cart), [items, cart]);
  const grand = selected.reduce((s, i) => s + i.price * cart[i.id], 0);

  const toggle = (it) => setCart(listKey, c => {
    const n = { ...c };
    if (it.id in n) delete n[it.id]; else n[it.id] = 1;
    return n;
  });
  const setQty = (id, q) => setCart(listKey, c => ({ ...c, [id]: q }));
  const clear = () => setCart(listKey, () => ({}));

  let lastSection = null;

  return (
    <div className="pl-wrap">
      <div className="pl-top">
        <button className="pl-back" onClick={onBack}>← Price Lists</button>
        <div className="pl-title">{card.icon} {card.lists.length === 1 ? card.title : card.title}
          <span className="pl-title-ar"> · {card.titleAr}</span></div>
      </div>

      {card.lists.length > 1 && (
        <div className="pl-tabs">
          {card.lists.map(k => (
            <button key={k} className={`pl-tab ${k === listKey ? 'on' : ''}`} onClick={() => setListKey(k)}>
              {PRICE_LISTS[k].title}
              {Object.keys(carts[k] || {}).length > 0 && <span className="pl-tab-n">{Object.keys(carts[k]).length}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="pl-tools">
        <input className="input pl-search" type="search" placeholder="Search item, number, unit, price… / بحث"
          value={query} onChange={e => setQuery(e.target.value)} />
        {sections.length > 1 && (
          <select className="select pl-sec" value={section} onChange={e => setSection(e.target.value)}>
            <option value="">All sections / كل الأقسام</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      <div className="pl-count">
        {state.loading ? 'Loading…' : `${filtered.length} of ${items.length} items`}
        {selected.length > 0 && (
          <label className="pl-only"><input type="checkbox" checked={onlySelected} onChange={e => setOnlySelected(e.target.checked)} /> Selected only</label>
        )}
      </div>

      {state.error ? (
        <div className="pl-msg">
          {state.error === 'no-session'
            ? <>Your secure session has expired. Please log out and sign in again.<br />انتهت الجلسة، يرجى تسجيل الدخول من جديد.<br /><button className="btn btn-primary-tariq btn-sm" style={{ marginTop: 12 }} onClick={onLogout}>Logout</button></>
            : <>Could not load this price list. / تعذر تحميل القائمة<br /><small>{state.error}</small></>}
        </div>
      ) : (
        <div className="pl-list">
          {filtered.map(it => {
            const head = it.section !== lastSection ? (lastSection = it.section) : null;
            const q = cart[it.id];
            const on = q !== undefined;
            return (
              <div key={it.id}>
                {head && <div className="pl-section">{head}</div>}
                <Row it={it} on={on} qty={q} onToggle={() => toggle(it)} onQty={v => setQty(it.id, v)} />
              </div>
            );
          })}
          {!state.loading && filtered.length === 0 && <div className="pl-msg">No matching items / لا توجد نتائج</div>}
        </div>
      )}

      {selected.length > 0 && (
        <div className="pl-bar">
          {showSummary && (
            <div className="pl-sum">
              <div className="pl-sum-head">
                <b>Selected items</b>
                <button className="pl-link" onClick={clear}>Clear all</button>
              </div>
              {selected.map(i => (
                <div key={i.id} className="pl-sum-row">
                  <span className="pl-sum-d">{i.itemNo && <b>{i.itemNo} </b>}{i.description || i.category}</span>
                  <span className="pl-sum-m">{cart[i.id]} × {sar(i.price)} = <b>{sar(i.price * cart[i.id])}</b></span>
                </div>
              ))}
            </div>
          )}
          <div className="pl-bar-main" onClick={() => setShowSummary(s => !s)}>
            <span>{selected.length} item{selected.length > 1 ? 's' : ''} {showSummary ? '▾' : '▴'}</span>
            <span className="pl-grand">Grand Total: {sar(grand)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Item row ───────────────────────────────────── */
function Row({ it, on, qty, onToggle, onQty }) {
  const [open, setOpen] = useState(false);
  const long = (it.description || '').length > 120 || (it.description || '').includes('\n');
  const title = it.description || it.category;
  return (
    <div className={`pl-row ${on ? 'on' : ''}`}>
      <div className="pl-row-main" onClick={onToggle}>
        <span className={`pl-chk ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
        <div className="pl-row-body">
          <div className="pl-row-meta">
            {it.itemNo && <span className="pl-no">{it.itemNo}</span>}
            {it.category && it.description && <span className="pl-cat">{it.category}</span>}
            {it.sizeSpec && <span className="pl-cat">{it.sizeSpec}</span>}
            {it.madeIn && <span className="pl-cat">{it.madeIn}</span>}
          </div>
          <div className={`pl-desc ${open ? 'open' : ''}`}>{title}</div>
          {!it.description && it.parentDescription && <div className="pl-parent">↳ {it.parentDescription}</div>}
          {it.descriptionAr && <div className={`pl-desc-ar ${open ? 'open' : ''}`} dir="rtl">{it.descriptionAr}</div>}
          {it.sectionNote && open && <div className="pl-note">{it.sectionNote}</div>}
          {(long || it.sectionNote || it.descriptionAr) && (
            <button className="pl-link" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>{open ? 'Less' : 'More'}</button>
          )}
        </div>
        <div className="pl-price">
          <b>{sar(it.price)}</b>
          <span>{it.unit ? `/ ${it.unit}` : ''}</span>
        </div>
      </div>
      {on && (
        <div className="pl-qty-row">
          <div className="pl-stepper">
            <button onClick={() => onQty(Math.max(0, cleanQty(qty - 1)))} aria-label="Decrease">−</button>
            <input type="number" min="0" step="any" inputMode="decimal" value={qty}
              onChange={e => onQty(e.target.value === '' ? '' : cleanQty(e.target.value))}
              onBlur={() => onQty(cleanQty(qty))} />
            <button onClick={() => onQty(cleanQty((Number(qty) || 0) + 1))} aria-label="Increase">+</button>
          </div>
          <div className="pl-line">Unit price {sar(it.price)}{it.unit ? ` / ${it.unit}` : ''} × {Number(qty) || 0} = <b>{sar(it.price * (Number(qty) || 0))}</b></div>
        </div>
      )}
    </div>
  );
}
