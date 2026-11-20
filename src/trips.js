// Technician live tracking ("متوجه للفرع") — table technician_trips
// (supabase_migration_v5_tracking.sql).
//
// A trip starts when a technician accepts a job, carries his phone's latest
// position while he drives, and ends on «تم الوصول» or cancel. Tariq's
// dashboard lists the active trips and follows them through Realtime.
import { supabase, logActivity } from './storage';

const TRIP_COLUMNS = 'id,request_id,technician,technician_name,status,accepted_at,ended_at,lat,lng,accuracy,heading,speed,location_at';

const fromDb = (r) => ({
  id:             r.id,
  requestId:      r.request_id,
  technician:     r.technician,
  technicianName: r.technician_name || r.technician,
  status:         r.status,
  acceptedAt:     r.accepted_at,
  endedAt:        r.ended_at,
  lat:            r.lat,
  lng:            r.lng,
  accuracy:       r.accuracy,
  heading:        r.heading,
  speed:          r.speed,
  locationAt:     r.location_at,
  request:        r.request ? {
    id:                 r.request.id,
    branchNumber:       r.request.branch_number,
    status:             r.request.status,
    problemDescription: r.request.problem_description || '',
  } : null,
});

export const hasLocation = (trip) => trip?.lat != null && trip?.lng != null;

// Active trips (en_route) with their request; a request that has been
// completed meanwhile no longer counts as "on the way".
export const getActiveTrips = async () => {
  const { data, error } = await supabase
    .from('technician_trips')
    .select(`${TRIP_COLUMNS},request:requests(id,branch_number,status,problem_description)`)
    .eq('status', 'en_route')
    .order('accepted_at', { ascending: true });
  if (error) { console.error('[getActiveTrips] ERROR:', error); return []; }
  return data.map(fromDb).filter(t => t.request && t.request.status !== 'completed');
};

// The technician's own active trip, if any (one at a time).
export const getMyActiveTrip = async (technician) => {
  const { data, error } = await supabase
    .from('technician_trips')
    .select(`${TRIP_COLUMNS},request:requests(id,branch_number,status,problem_description)`)
    .eq('status', 'en_route')
    .eq('technician', technician)
    .order('accepted_at', { ascending: false })
    .limit(1);
  if (error) { console.error('[getMyActiveTrip] ERROR:', error); return null; }
  return data[0] ? fromDb(data[0]) : null;
};

// «تم قبول الطلب»: start a trip. Fails (returns { error }) when this request
// already has a technician on the way.
export const acceptRequest = async (requestId, user) => {
  const { data, error } = await supabase
    .from('technician_trips')
    .insert({ request_id: requestId, technician: user.username, technician_name: user.nameAr || user.name, status: 'en_route' })
    .select(TRIP_COLUMNS)
    .single();
  if (error) {
    console.error('[acceptRequest] ERROR:', error);
    return { error: error.code === '23505' ? 'taken' : 'failed' };
  }
  await logActivity({ requestId, action: 'trip_accepted', actor: user.name, actorRole: user.role, notify: true });
  return { trip: fromDb(data) };
};

export const updateTripLocation = async (tripId, coords) => {
  const { error } = await supabase
    .from('technician_trips')
    .update({
      lat: coords.latitude, lng: coords.longitude,
      accuracy: coords.accuracy ?? null,
      heading: Number.isFinite(coords.heading) ? coords.heading : null,
      speed: Number.isFinite(coords.speed) ? coords.speed : null,
      location_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .eq('status', 'en_route');
  if (error) console.error('[updateTripLocation] ERROR:', error);
  return !error;
};

// «تم الوصول» (arrived) or cancel: stop tracking.
export const endTrip = async (trip, status, user) => {
  const { error } = await supabase
    .from('technician_trips')
    .update({ status, ended_at: new Date().toISOString() })
    .eq('id', trip.id);
  if (error) { console.error('[endTrip] ERROR:', error); return false; }
  await logActivity({
    requestId: trip.requestId, action: status === 'arrived' ? 'trip_arrived' : 'trip_cancelled',
    actor: user.name, actorRole: user.role, notify: true,
  });
  return true;
};

// Calls `onChange` whenever any trip row changes (insert / position / end).
// Returns an unsubscribe function.
export const subscribeTrips = (onChange) => {
  const channel = supabase
    .channel(`technician_trips_${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_trips' }, (payload) => onChange(payload))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};
