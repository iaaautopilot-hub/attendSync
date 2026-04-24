import { supabase } from './lib/supabase';
import bcrypt from 'bcryptjs';

const AUTH_KEY = 'attendance_app_user';

// --- AUTH & USER MANAGEMENT ---

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*, roles(role_name), rank(rank_name), hub(hub_name)');
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  
  // Flatten and map for easier app usage
  return data.map(u => ({
    ...u,
    name: u.full_name,
    role: u.roles?.role_name 
      ? u.roles.role_name.charAt(0).toUpperCase() + u.roles.role_name.slice(1) 
      : 'Chairman',
    rank: u.rank?.rank_name || '',
    hub: u.hub?.hub_name || ''
  }));
};

export const getUsersByRole = async (roleName) => {
  const all = await getAllUsers();
  return all.filter(u => u.role?.toLowerCase() === roleName?.toLowerCase());
};

export const validateLogin = async (username, password) => {
  console.log('Attempting login for:', username);
  const { data, error } = await supabase
    .from('users')
    .select('*, roles(role_name)')
    .ilike('username', username);
    
  if (error || !data || data.length === 0) {
    console.warn('No user found.');
    return null;
  }

  const user = data[0];
  
  // Try bcrypt comparison
  let isMatch = false;
  try {
    isMatch = bcrypt.compareSync(password, user.password);
  } catch (e) {
    // Malformed hash or plain text
    isMatch = false;
  }

  // If no hash match, check for plain-text (migration path)
  if (!isMatch && password === user.password) {
    console.log('Plain-text password detected. Upgrading to hash...');
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    await supabase.from('users').update({ password: hash }).eq('staff_id', user.staff_id);
    isMatch = true;
  }

  if (!isMatch) {
    console.warn('Password mismatch.');
    return null;
  }

  console.log('Login successful for:', user.full_name);
  return { ...user, name: user.full_name, role: user.roles?.role_name || 'Admin' };
};

export const loginUser = (username, role) => {
  const user = { username, role, token: Date.now().toString() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem(AUTH_KEY);
};

export const getCurrentUser = async () => {
  const storedSession = localStorage.getItem(AUTH_KEY);
  if (!storedSession) return null;
  const session = JSON.parse(storedSession);
  
  const { data, error } = await supabase
    .from('users')
    .select('*, roles(role_name)')
    .eq('username', session.username);
    
  const user = data && data.length > 0 ? data[0] : null;
  if (error || !user) return session;
  return { ...user, name: user.full_name, staff_id: user.staff_id, role: user.roles?.role_name, token: session.token };
};

export const addUser = async (userData) => {
  // We need to resolve the role_id first if it's passed as a name
  const { data: role } = await supabase.from('roles').select('id').ilike('role_name', userData.role).single();
  
  // Hash password before saving
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(userData.password || '123', salt);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      staff_id: userData.staffId || userData.username, 
      full_name: userData.name,
      username: userData.username,
      password: hashedPassword,
      role_id: role?.id,
      email: userData.email,
      loa_no: userData.loaNo
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding user:', error);
    return { error };
  }

  return { data };
};

export const updateUser = async (userData) => {
  // 1. Find the correct Role ID (case-insensitive)
  const { data: roleData } = await supabase
    .from('roles')
    .select('id')
    .ilike('role_name', userData.role)
    .single();

  if (!roleData) {
    console.error('Role not found for:', userData.role);
    return { error: { message: `Role "${userData.role}" not found in database.` } };
  }

  // 2. Perform the update
  const { data, error } = await supabase
    .from('users')
    .update({
      staff_id: userData.staffId, // New ID
      full_name: userData.name,
      username: userData.username,
      // Only update password if explicitly provided and not empty
      ...(userData.password && userData.password !== '••••••••' ? { password: bcrypt.hashSync(userData.password, bcrypt.genSaltSync(10)) } : {}),
      role_id: roleData.id,
      email: userData.email,
      loa_no: userData.loaNo
    })
    .eq('staff_id', userData.original_staff_id || userData.staffId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    return { error };
  }

  return { data };
};
export const updateUserSignature = async (staffId, signatureData) => {
  const { error } = await supabase
    .from('users')
    .update({ signature_data: signatureData })
    .eq('staff_id', staffId);
  return !error;
};
export const deleteUser = async (staffId) => {
  return await supabase.from('users').delete().eq('staff_id', staffId);
};

export const updateUserPassword = async (username, newPassword) => {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(newPassword, salt);
  
  const { error } = await supabase
    .from('users')
    .update({ password: hash, must_change_password: false })
    .ilike('username', username);
  return !error;
};

// --- EVENT MANAGEMENT ---

export const getAllEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('*, event_assignments(user_id, assigned_role, users(full_name))')
    .order('created_at', { ascending: false });

  if (error) return [];

  return data.map(e => ({
    ...e,
    name: e.subject,
    date: e.event_date,
    time: e.event_time,
    isActive: e.is_active && (!e.activated_at || (new Date() - new Date(e.activated_at)) < 8 * 3600 * 1000),
    isExpired: e.activated_at && (new Date() - new Date(e.activated_at)) >= 8 * 3600 * 1000,
    type: e.event_type,
    leaders: e.event_assignments?.map(a => a.users?.full_name).filter(Boolean) || []
  }));
};

export const saveEvent = async (eventData) => {
  // 1. Create the event
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .insert([{
      subject: eventData.name,
      event_type: eventData.type,
      event_date: eventData.date,
      event_time: eventData.time,
      venue: eventData.venue,
      room: eventData.room,
      department: eventData.department,
      is_active: false
    }])
    .select()
    .single();

  if (eventErr) {
    console.error('Error saving event:', eventErr);
    throw eventErr;
  }

  // 2. Assign leaders
  if (eventData.leaders && eventData.leaders.length > 0) {
    const assignments = [];
    for (const leaderName of eventData.leaders) {
      const { data: leader } = await supabase.from('users').select('staff_id').eq('full_name', leaderName).single();
      if (leader) {
        assignments.push({
          event_id: event.id,
          user_id: leader.staff_id,
          assigned_role: eventData.type === 'Training' ? 'instructor' : 'chairman'
        });
      }
    }
    if (assignments.length > 0) {
      await supabase.from('event_assignments').insert(assignments);
    }
  }

  return { ...event, name: event.subject };
};

export const getEvent = async (id) => {
  if (!id) {
    const all = await getAllEvents();
    return all[0] || null;
  }

  const { data, error } = await supabase
    .from('events')
    .select('*, event_assignments(user_id, assigned_role, users(full_name, staff_id, loa_no))')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    name: data.subject,
    date: data.event_date,
    time: data.event_time,
    isActive: data.is_active && (!data.activated_at || (new Date() - new Date(data.activated_at)) < 8 * 3600 * 1000),
    isExpired: data.activated_at && (new Date() - new Date(data.activated_at)) >= 8 * 3600 * 1000,
    type: data.event_type,
    leaders: data.event_assignments?.map(a => a.users?.full_name).filter(Boolean) || [],
    leaderDetails: data.event_assignments?.map(a => ({
      name: a.users?.full_name,
      staff_id: a.users?.staff_id,
      loa_no: a.users?.loa_no
    })).filter(ld => ld.name) || []
  };
};

export const activateEvent = async (id, signatureData, remarks = '') => {
  const { data, error } = await supabase
    .from('events')
    .update({ 
      is_active: true, 
      leader_signature: signatureData,
      remarks: remarks,
      activated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error activating event:', error);
    return { error };
  }
  
  // Re-fetch full event details to ensure all fields like leaderDetails are present
  return await getEvent(id);
};

export const updateEventRemarks = async (id, remarks) => {
  const { error } = await supabase
    .from('events')
    .update({ remarks })
    .eq('id', id);
    
  if (error) {
    console.error('Database Error (Updating Remarks):', error);
    return false;
  }
  return true;
};

export const clearEvent = async (id) => {
  const { error } = await supabase.from('events').delete().eq('id', id);
  return !error;
};

// --- PARTICIPANTS ---

export const getParticipants = async (eventId) => {
  const { data, error } = await supabase
    .from('event_signatures')
    .select('*')
    .eq('event_id', eventId);

  if (error) {
    console.error('Error fetching participants:', error);
    return [];
  }

  return data.map(s => ({
    id: s.id,
    name: s.participant_name || 'Unknown',
    staffId: s.staff_id,
    rank: s.participant_rank || '',
    hub: s.participant_hub || '',
    license: s.participant_license || '',
    signature: s.signature_data,
    scannedAt: s.created_at
  }));
};

export const findUserByStaffId = async (staffId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*, rank(rank_name), hub(hub_name)')
    .eq('staff_id', staffId)
    .eq('staff_id', staffId)
    .single();
  
  if (error || !data) return null;
  return {
    ...data,
    name: data.full_name,
    rank: data.rank?.rank_name,
    hub: data.hub?.hub_name,
    license: data.loa_no
  };
};

export const checkAttendanceExists = async (eventId, staffId) => {
  const { data, error } = await supabase
    .from('event_signatures')
    .select('id')
    .eq('event_id', eventId)
    .eq('staff_id', staffId)
    .maybeSingle();
  
  return !!data;
};

export const saveSignature = async (participantData) => {
  const { event_id, ...data } = participantData;
  const { data: result, error } = await supabase
    .from('event_signatures')
    .insert([{
      event_id: event_id,
      staff_id: data.staffId,
      participant_name: data.name,
      participant_rank: data.rank,
      participant_hub: data.hub,
      participant_license: data.license,
      signature_data: data.signature,
      remarks: data.remarks || ''
    }])
    .select();
  
  if (error) {
    console.error('Error adding participant:', error);
    return { error };
  }

  return { data: result ? result[0] : null };
};
