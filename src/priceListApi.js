import { supabase } from './storage';

// Price List data access — Tariq only.
// The browser never holds price data in its bundle: every row is read from
// `price_list_items`, whose RLS answers only to Tariq's Supabase Auth session
// (see supabase_migration_v3_price_list.sql). For anyone else this returns
// nothing / an error even if the UI gate were bypassed.

export const PRICE_LISTS = {
  hvac:        { title: 'HVAC & Cold Room', titleAr: 'التكييف والغرف المبردة', icon: '❄️', source: 'Price List Agreement — HVAC & Cold Room' },
  mep:         { title: 'MEP & Décor',      titleAr: 'الكهروميكانيكا والديكور', icon: '🛠️', source: 'Price List Agreement — MEP & Décor' },
  proj_signs:  { title: 'Project Signages',     source: 'Price List Agreement — Project Signages' },
  maint_signs: { title: 'Maintenance Signages', source: 'Price List Agreement — Maintenance Signages' },
};

const PAGE = 1000;

export async function fetchPriceListItems(listKey) {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) return { error: 'no-session', items: [] };

  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('price_list_items')
      .select('*')
      .eq('list_key', listKey)
      .order('sort_order', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { error: error.message || 'error', items: [] };
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  const items = rows.map(r => ({
    id: r.id,
    itemNo: r.item_no || '',
    description: r.description || '',
    descriptionAr: r.description_ar || '',
    category: r.category || '',
    section: r.section || '',
    sectionNote: r.section_note || '',
    parentDescription: r.parent_description || '',
    sizeSpec: r.size_spec || '',
    madeIn: r.made_in || '',
    unit: r.unit || '',
    leadTime: r.lead_time || '',
    price: Number(r.price),
  }));
  return { error: null, items };
}
