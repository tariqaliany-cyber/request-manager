import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Auth ─────────────────────────────────────────────
export const USERS = {
  essa:  { password: 'essa123',  role: 'essa',  name: 'Essa',  nameAr: 'عيسى'  },
  majed: { password: 'majed123', role: 'majed', name: 'Majed', nameAr: 'ماجد'  },
  tariq: { password: 'tariq123', role: 'tariq', name: 'Tariq', nameAr: 'طارق'  },
};

export const STATUS = {
  received:    { en: 'Request Received', ar: 'تم استلام الطلب', color: '#3B82F6', bg: '#EFF6FF' },
  scheduled:   { en: 'Scheduled',        ar: 'مجدول',           color: '#D97706', bg: '#FFFBEB' },
  in_progress: { en: 'In Progress',      ar: 'قيد التنفيذ',     color: '#563b2c', bg: '#fdf6f0' },
  completed:   { en: 'Completed',        ar: 'مكتمل',           color: '#16A34A', bg: '#F0FDF4' },
};

export const PRIORITY = {
  low:    { en: 'Low',    ar: 'منخفضة', color: '#64748B', bg: '#F1F5F9' },
  normal: { en: 'Normal', ar: 'عادية',   color: '#3B82F6', bg: '#EFF6FF' },
  high:   { en: 'High',   ar: 'عالية',   color: '#D97706', bg: '#FFFBEB' },
  urgent: { en: 'Urgent', ar: 'عاجلة',   color: '#EF4444', bg: '#FEF2F2' },
};

export const PAYMENT_STATUS = {
  unpaid:  { en: 'Unpaid',  ar: 'غير مدفوعة', color: '#EF4444', bg: '#FEF2F2' },
  partial: { en: 'Partial', ar: 'جزئية',      color: '#D97706', bg: '#FFFBEB' },
  paid:    { en: 'Paid',    ar: 'مدفوعة',      color: '#16A34A', bg: '#F0FDF4' },
};

// ── Delivery Notes (Tariq-only feature) ───────────────
// canManageDeliveryNotes is the single source of truth for who can see/use
// this feature. EssaView and MajedView never import anything delivery-note
// related, so it has zero footprint outside Tariq's dashboard.
export const canManageDeliveryNotes = (user) => user?.role === 'tariq';

export const DELIVERY_NOTE_STATUS = {
  draft:               { en: 'Draft',               ar: 'مسودة',            color: '#64748B', bg: '#F1F5F9' },
  ready_for_signature: { en: 'Ready for Signature',  ar: 'جاهز للتوقيع',     color: '#D97706', bg: '#FFFBEB' },
  signed:              { en: 'Signed',               ar: 'موقّع',            color: '#16A34A', bg: '#F0FDF4' },
  cancelled:           { en: 'Cancelled',            ar: 'ملغى',             color: '#EF4444', bg: '#FEF2F2' },
};

export const authenticate = (username, password) => {
  const u = USERS[username.toLowerCase()];
  if (u && u.password === password) return { username: username.toLowerCase(), ...u };
  return null;
};

// ── Photos ────────────────────────────────────────────
// Photo array items used to be plain base64 data-URL strings. New uploads
// are stored as { url, caption } objects so photos can carry a caption;
// normalizePhotos reads old plain-string rows the same way so no data
// migration is needed. photoSrc/photoCaption read either shape safely.
export const normalizePhotos = (arr) => (arr || []).map(p => typeof p === 'string' ? { url: p, caption: '' } : p);
export const photoSrc     = (p) => typeof p === 'string' ? p : p.url;
export const photoCaption = (p) => typeof p === 'string' ? '' : (p.caption || '');

// ── Field mapping (camelCase ↔ snake_case) ───────────
const FIELD_MAP = {
  createdAt:                    'created_at',
  branchNumber:                 'branch_number',
  locationLink:                 'location_link',
  problemDescription:           'problem_description',
  problemPhotos:                'problem_photos',
  createdBy:                    'created_by',
  assignedTo:                   'assigned_to',
  internalNotes:                'internal_notes',
  notesToMajed:                 'notes_to_majed',
  notesToEssa:                  'notes_to_essa',
  showWorkDoneToEssa:           'show_work_done_to_essa',
  showCompletionPhotosToEssa:   'show_completion_photos_to_essa',
  majedStarted:                 'majed_started',
  majedComments:                'majed_comments',
  progressPhotos:               'progress_photos',
  completionPhotos:             'completion_photos',
  workDone:                     'work_done',
  finalSummary:                 'final_summary',
  invoiceAmount:                'invoice_amount',
  progressPercentage:           'progress_percentage',
  paymentStatus:                'payment_status',
  paymentDate:                  'payment_date',
  internalAccountingNote:       'internal_accounting_note',
  dueDate:                      'due_date',
};

const toDb = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[FIELD_MAP[k] || k] = v;
  return out;
};

const fromDb = (row) => ({
  id:                           row.id,
  createdAt:                    row.created_at,
  status:                       row.status,
  branchNumber:                 row.branch_number,
  locationLink:                 row.location_link       || '',
  problemDescription:           row.problem_description || '',
  problemPhotos:                normalizePhotos(row.problem_photos),
  createdBy:                    row.created_by,
  assignedTo:                   row.assigned_to         || null,
  internalNotes:                row.internal_notes      || '',
  notesToMajed:                 row.notes_to_majed      || '',
  notesToEssa:                  row.notes_to_essa       || '',
  showWorkDoneToEssa:           row.show_work_done_to_essa           || false,
  showCompletionPhotosToEssa:   row.show_completion_photos_to_essa   || false,
  majedStarted:                 row.majed_started       || false,
  majedComments:                row.majed_comments      || [],
  progressPhotos:               normalizePhotos(row.progress_photos),
  completionPhotos:             normalizePhotos(row.completion_photos),
  workDone:                     row.work_done           || '',
  finalSummary:                 row.final_summary       || '',
  invoiceAmount:                row.invoice_amount      ?? null,
  progressPercentage:           row.progress_percentage ?? 0,
  priority:                     row.priority             || 'normal',
  paymentStatus:                row.payment_status       || 'unpaid',
  paymentDate:                  row.payment_date         || null,
  internalAccountingNote:       row.internal_accounting_note || '',
  dueDate:                      row.due_date             || null,
});

// ── CRUD ─────────────────────────────────────────────
export const getRequests = async () => {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[getRequests] ERROR:', error); return []; }
  return data.map(fromDb);
};

// Columns a list/dashboard view actually renders — deliberately excludes
// problem_photos/progress_photos/completion_photos (base64 images), which
// made a plain select('*') over the whole table tens of megabytes and slow
// to load. Use getRequestById for a single request's full detail.
const LIST_COLUMNS = 'id,created_at,status,branch_number,assigned_to,invoice_amount,progress_percentage,problem_description,created_by,priority,payment_status,due_date';

export const getRequestListItems = async ({ createdBy, assignedTo, status } = {}) => {
  let query = supabase.from('requests').select(LIST_COLUMNS).order('created_at', { ascending: false });
  if (createdBy)  query = query.eq('created_by', createdBy);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);
  if (status)     query = query.eq('status', status);
  const { data, error } = await query;
  if (error) { console.error('[getRequestListItems] ERROR:', error); return []; }
  return data.map(fromDb);
};

export const getRequestById = async (id) => {
  const { data, error } = await supabase.from('requests').select('*').eq('id', id).single();
  if (error) { console.error('[getRequestById] ERROR:', error); return null; }
  return fromDb(data);
};

export const createRequest = async (input) => {
  const req = {
    id:                         'REQ-' + Date.now(),
    created_at:                 new Date().toISOString(),
    status:                     'received',
    assigned_to:                null,
    internal_notes:             '',
    notes_to_majed:             '',
    notes_to_essa:              '',
    show_work_done_to_essa:     false,
    show_completion_photos_to_essa: false,
    majed_started:              false,
    majed_comments:             [],
    progress_photos:            [],
    completion_photos:          [],
    work_done:                  '',
    final_summary:              '',
    invoice_amount:             null,
    progress_percentage:        0,
    priority:                   'normal',
    payment_status:             'unpaid',
    payment_date:               null,
    internal_accounting_note:   '',
    due_date:                   null,
    ...toDb(input),
  };
  const { data, error } = await supabase
    .from('requests').insert(req).select().single();
  if (error) { console.error('createRequest:', error); return null; }
  return fromDb(data);
};

export const updateRequest = async (id, updates) => {
  const dbUpdates = toDb(updates);
  const { data, error } = await supabase
    .from('requests').update(dbUpdates).eq('id', id).select().single();
  if (error) {
    console.error('[updateRequest] ERROR:', error);
    return null;
  }
  return fromDb(data);
};

export const deleteRequest = async (id) => {
  const { error } = await supabase.from('requests').delete().eq('id', id);
  if (error) { console.error('deleteRequest:', error); return false; }
  return true;
};

// ── Delivery Notes CRUD ────────────────────────────────
const DN_FIELD_MAP = {
  requestId:            'request_id',
  createdAt:            'created_at',
  updatedAt:            'updated_at',
  createdBy:            'created_by',
  branchNumber:         'branch_number',
  branchName:           'branch_name',
  branchLocation:       'branch_location',
  requestDate:          'request_date',
  completionDate:       'completion_date',
  wrpNumber:            'wrp_number',
  generalRemarks:       'general_remarks',
};

const dnToDb = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[DN_FIELD_MAP[k] || k] = v;
  return out;
};

const dnFromDb = (row) => ({
  id:                   row.id,
  number:               row.number,
  requestId:            row.request_id,
  status:               row.status,
  createdBy:            row.created_by,
  createdAt:            row.created_at,
  updatedAt:            row.updated_at,
  branchNumber:         row.branch_number   || '',
  branchName:           row.branch_name     || '',
  branchLocation:       row.branch_location || '',
  requestDate:          row.request_date    || '',
  completionDate:       row.completion_date || '',
  wrpNumber:            row.wrp_number      || '',
  items:                row.items           || [],
  generalRemarks:       row.general_remarks || '',
});

export const getDeliveryNotesByRequest = async (requestId) => {
  const { data, error } = await supabase
    .from('delivery_notes')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getDeliveryNotesByRequest:', error); return []; }
  return data.map(dnFromDb);
};

// Generates the next sequential DN-<year>-#### number by looking at the
// highest existing number for the current year.
export const generateDeliveryNoteNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `DN-${year}-`;
  const { data, error } = await supabase
    .from('delivery_notes')
    .select('number')
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1);
  if (error) console.error('generateDeliveryNoteNumber:', error);
  const last = data?.[0]?.number;
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
};

// Retries a few times on a unique-constraint violation (duplicate number)
// to stay safe under near-simultaneous creates without needing a DB sequence.
export const createDeliveryNote = async (input) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = input.number || await generateDeliveryNoteNumber();
    const note = {
      id:               'DN-' + Date.now(),
      status:           'draft',
      items:            [],
      general_remarks:  '',
      ...dnToDb(input),
      number,
    };
    const { data, error } = await supabase.from('delivery_notes').insert(note).select().single();
    if (!error) return dnFromDb(data);
    if (error.code !== '23505') { console.error('createDeliveryNote:', error); return null; }
    // duplicate number — regenerate and retry
  }
  console.error('createDeliveryNote: exhausted retries generating a unique number');
  return null;
};

export const updateDeliveryNote = async (id, updates) => {
  const { data, error } = await supabase
    .from('delivery_notes')
    .update({ ...dnToDb(updates), updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) { console.error('updateDeliveryNote:', error); return null; }
  return dnFromDb(data);
};

export const deleteDeliveryNote = async (id) => {
  const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
  if (error) { console.error('deleteDeliveryNote:', error); return false; }
  return true;
};

// ── BOQ Library ─────────────────────────────────────────
// Custom items are only added here when the user explicitly clicks
// "Save to BOQ Library" — never automatically.
export const getBoqLibraryItems = async () => {
  const { data, error } = await supabase
    .from('boq_library_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getBoqLibraryItems:', error); return []; }
  return data.map(row => ({
    itemNo:      row.item_no || '',
    category:    row.category || 'Custom',
    description: row.description,
    unit:        row.unit || '',
  }));
};

export const createBoqLibraryItem = async ({ itemNo, category, description, unit, createdBy }) => {
  const row = {
    id:          'BOQL-' + Date.now(),
    item_no:     itemNo || '',
    category:    category || 'Custom',
    description,
    unit:        unit || '',
    created_by:  createdBy,
  };
  const { data, error } = await supabase.from('boq_library_items').insert(row).select().single();
  if (error) { console.error('createBoqLibraryItem:', error); return null; }
  return { itemNo: data.item_no || '', category: data.category || 'Custom', description: data.description, unit: data.unit || '' };
};

// ── Activity log ───────────────────────────────────────
// Replaces the old `notifications` table: a per-request activity feed
// (queried by request_id) that also doubles as the global "Updates" bell
// feed for entries with notify:true. Kept as its own table rather than a
// jsonb column on requests — same reasoning as majed_comments would run
// into at scale: a per-request feed needs independent pagination, and a
// growing jsonb array would get pulled into every getRequestById fetch.
const ACTION_LABELS = {
  started:           { en: '🚀 Work started',              ar: 'بدأ العمل'              },
  comment:           { en: '💬 Comment added',             ar: 'تعليق جديد'             },
  progress_photos:   { en: '📷 Progress photos uploaded',  ar: 'صور التقدم'             },
  completion_photos: { en: '📷 Completion photos uploaded',ar: 'صور الإنجاز'            },
  work_done:         { en: '✅ Work description updated',   ar: 'وصف العمل المنجز'       },
  status_changed:    { en: '🔄 Status changed',             ar: 'تغيير الحالة'           },
  assigned_changed:  { en: '👷 Assignment changed',         ar: 'تغيير الإسناد'          },
  dn_created:        { en: '📄 Delivery Note created',      ar: 'إنشاء إشعار استلام'     },
  dn_signed:         { en: '✍️ Delivery Note signed',       ar: 'توقيع إشعار الاستلام'   },
  request_created:   { en: '🆕 Request created',            ar: 'إنشاء الطلب'            },
};

export const ACTION_LABELS_MAP = ACTION_LABELS;

export const logActivity = async ({ requestId, action, actor, actorRole, detail, notify = false }) => {
  const { error } = await supabase.from('activity_log').insert({
    id:          'ACT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    request_id:  requestId,
    action,
    actor:       actor || '',
    actor_role:  actorRole || '',
    detail:      detail || '',
    notify,
  });
  if (error) console.error('logActivity:', error);
};

export const getActivityLog = async (requestId) => {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getActivityLog:', error); return []; }
  return data;
};

export const getRecentNotifications = async (limit = 60) => {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('notify', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getRecentNotifications:', error); return []; }
  return data;
};

// localStorage-based last-read timestamp (per Tariq's browser)
const LAST_READ_KEY = 'tariq_notif_last_read';
export const getLastRead = () => localStorage.getItem(LAST_READ_KEY) || '';
export const setLastRead = () => localStorage.setItem(LAST_READ_KEY, new Date().toISOString());

export const addMajedComment = async (id, text) => {
  const { data: current } = await supabase
    .from('requests').select('majed_comments').eq('id', id).single();
  const comments = [...(current?.majed_comments || []), { text, time: new Date().toISOString() }];
  const { data, error } = await supabase
    .from('requests').update({ majed_comments: comments }).eq('id', id).select().single();
  if (error) { console.error('addMajedComment:', error); return null; }
  return fromDb(data);
};

// ── Helpers ───────────────────────────────────────────
export const compressImage = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width: w, height: h } = img;
        if (w > h && w > MAX) { h = (h * MAX) / w; w = MAX; }
        else if (h > MAX)     { w = (w * MAX) / h; h = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

export const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};
