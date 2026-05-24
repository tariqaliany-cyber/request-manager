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

export const authenticate = (username, password) => {
  const u = USERS[username.toLowerCase()];
  if (u && u.password === password) return { username: username.toLowerCase(), ...u };
  return null;
};

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
  problemPhotos:                row.problem_photos      || [],
  createdBy:                    row.created_by,
  assignedTo:                   row.assigned_to         || null,
  internalNotes:                row.internal_notes      || '',
  notesToMajed:                 row.notes_to_majed      || '',
  notesToEssa:                  row.notes_to_essa       || '',
  showWorkDoneToEssa:           row.show_work_done_to_essa           || false,
  showCompletionPhotosToEssa:   row.show_completion_photos_to_essa   || false,
  majedStarted:                 row.majed_started       || false,
  majedComments:                row.majed_comments      || [],
  progressPhotos:               row.progress_photos     || [],
  completionPhotos:             row.completion_photos   || [],
  workDone:                     row.work_done           || '',
  finalSummary:                 row.final_summary       || '',
  invoiceAmount:                row.invoice_amount      ?? null,
  progressPercentage:           row.progress_percentage ?? 0,
});

// ── CRUD ─────────────────────────────────────────────
export const getRequests = async () => {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getRequests:', error); return []; }
  return data.map(fromDb);
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
    ...toDb(input),
  };
  const { data, error } = await supabase
    .from('requests').insert(req).select().single();
  if (error) { console.error('createRequest:', error); return null; }
  return fromDb(data);
};

export const updateRequest = async (id, updates) => {
  const { data, error } = await supabase
    .from('requests').update(toDb(updates)).eq('id', id).select().single();
  if (error) { console.error('updateRequest:', error); return null; }
  return fromDb(data);
};

export const deleteRequest = async (id) => {
  const { error } = await supabase.from('requests').delete().eq('id', id);
  if (error) { console.error('deleteRequest:', error); return false; }
  return true;
};

// ── Notifications ─────────────────────────────────────
const ACTION_LABELS = {
  started:           { en: '🚀 Work started',              ar: 'بدأ العمل'              },
  comment:           { en: '💬 Comment added',             ar: 'تعليق جديد'             },
  progress_photos:   { en: '📷 Progress photos uploaded',  ar: 'صور التقدم'             },
  completion_photos: { en: '📷 Completion photos uploaded',ar: 'صور الإنجاز'            },
  work_done:         { en: '✅ Work description updated',   ar: 'وصف العمل المنجز'       },
};

export const ACTION_LABELS_MAP = ACTION_LABELS;

export const createNotification = async ({ reqId, branchNumber, problemDescription, action, detail }) => {
  const { error } = await supabase.from('notifications').insert({
    req_id:              reqId,
    branch_number:       branchNumber,
    problem_description: problemDescription,
    actor:               'Majed',
    action,
    detail:              detail || null,
  });
  if (error) console.error('createNotification:', error);
};

export const getNotifications = async () => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) { console.error('getNotifications error:', JSON.stringify(error)); return []; }
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
