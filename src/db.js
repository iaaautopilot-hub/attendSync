import { supabase } from './lib/supabase';
import bcrypt from 'bcryptjs';

const AUTH_KEY = 'attendance_app_user';

const ROLE_MAP = {
  'admin': '08db30cb-be6d-4880-bfb8-fc5372bab3ee',
  'system administrator': 'd1b7d519-8664-4e1b-b461-12c8b7470ea2',
  'chairman': '2ac81965-9702-4886-9105-a060a74a06aa',
  'instructor': 'dbf92d41-16b4-4b93-9a33-82148ba8ceec'
};

const ROLE_ID_MAP = {
  '08db30cb-be6d-4880-bfb8-fc5372bab3ee': 'Admin',
  'd1b7d519-8664-4e1b-b461-12c8b7470ea2': 'System Administrator',
  '2ac81965-9702-4886-9105-a060a74a06aa': 'Chairman',
  'dbf92d41-16b4-4b93-9a33-82148ba8ceec': 'Instructor'
};

const getRoleId = (roleName) => {
  return ROLE_MAP[roleName?.toLowerCase()] || null;
};

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
  return data.map(u => {
    const legacyRole = u.roles?.role_name
      ? u.roles.role_name.charAt(0).toUpperCase() + u.roles.role_name.slice(1)
      : (ROLE_ID_MAP[u.role_id] || 'Chairman');

    return {
      ...u,
      name: u.full_name,
      multi_roles: u.multi_roles && u.multi_roles.length > 0 ? u.multi_roles : [legacyRole],
      role: (u.multi_roles && u.multi_roles.length > 0) ? u.multi_roles[0] : legacyRole,
      rank: u.rank?.rank_name || '',
      hub: u.hub?.hub_name || ''
    };
  });
};

export const getUsersByRole = async (roleName) => {
  const all = await getAllUsers();
  return all.filter(u => u.multi_roles?.some(r => r.toLowerCase() === roleName?.toLowerCase()));
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
  const legacyRole = user.roles?.role_name || ROLE_ID_MAP[user.role_id] || 'Admin';
  return {
    ...user,
    name: user.full_name,
    multi_roles: user.multi_roles && user.multi_roles.length > 0 ? user.multi_roles : [legacyRole],
    role: (user.multi_roles && user.multi_roles.length > 0) ? user.multi_roles[0] : legacyRole
  };
};

export const loginUser = (username, multi_roles) => {
  // Deprecated for Google SSO but kept for compatibility
  const user = { username, multi_roles, token: Date.now().toString() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return user;
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
  localStorage.removeItem(AUTH_KEY);
};

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return null;

  const email = session.user.email;

  const { data, error } = await supabase
    .from('users')
    .select('*, roles(role_name)')
    .eq('email', email);

  const user = data && data.length > 0 ? data[0] : null;

  if (error || !user) {
    console.warn("Authenticated via Google but email not found in users table:", email);
    return null;
  }

  const legacyRole = user.roles?.role_name || ROLE_ID_MAP[user.role_id] || 'Admin';

  return {
    ...user,
    name: user.full_name,
    staff_id: user.staff_id,
    multi_roles: user.multi_roles && user.multi_roles.length > 0 ? user.multi_roles : [legacyRole],
    role: (user.multi_roles && user.multi_roles.length > 0) ? user.multi_roles[0] : legacyRole,
    token: session.access_token
  };
};


export const addUser = async (userData) => {
  const rolesArr = userData.multi_roles || [userData.role];
  const roleId = getRoleId(rolesArr[0]);

  // Hash password before saving
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(userData.password || '123', salt);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      staff_id: userData.staffId || userData.username,
      full_name: userData.name,
      username: userData.username || userData.staffId,
      password: hashedPassword,
      role_id: roleId,
      multi_roles: rolesArr,
      email: userData.email,
      loa_no: userData.loaNo
    }])
    .select();

  if (error) {
    console.error('Error adding user:', error);
    return { error };
  }

  return { data: data?.[0] || null };
};

export const updateUser = async (userData) => {
  const rolesArr = userData.multi_roles || [userData.role];
  const roleId = getRoleId(rolesArr[0]);

  if (!roleId) {
    console.error('Role not found for:', rolesArr);
    return { error: { message: `Role "${rolesArr.join(', ')}" not found in database.` } };
  }

  // 2. Perform the update
  const { data, error } = await supabase
    .from('users')
    .update({
      staff_id: userData.staffId, // New ID
      full_name: userData.name,
      username: userData.username || userData.staffId,
      // Only update password if explicitly provided and not empty
      ...(userData.password && userData.password !== '••••••••' ? { password: bcrypt.hashSync(userData.password, bcrypt.genSaltSync(10)) } : {}),
      role_id: roleId,
      multi_roles: rolesArr,
      email: userData.email,
      loa_no: userData.loaNo
    })
    .eq('staff_id', userData.original_staff_id || userData.staffId)
    .select();

  if (error) {
    console.error('Error updating user:', error);
    return { error };
  }

  return { data: data?.[0] || null };
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

export const getAllDepartments = async () => {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name');
  if (error) {
    console.error('Error fetching departments:', error);
    return [];
  }
  return data;
};

export const addDepartment = async (department) => {
  const { data, error } = await supabase
    .from('departments')
    .insert([department])
    .select();
  if (error) throw error;
  return data[0];
};

export const updateDepartment = async (id, updates) => {
  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data[0];
};

export const deleteDepartment = async (id) => {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);
  if (error) throw error;
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

  return data.map(e => {
    let displayTime = e.event_time ? e.event_time.substring(0, 5) : '';
    let cleanRemarks = e.remarks || '';
    if (e.event_type === 'Training' && cleanRemarks.includes('[END:')) {
      const match = cleanRemarks.match(/\[END:([^\]]+)\]/);
      if (match && match[1]) {
        displayTime = `${displayTime} - ${match[1].trim()}`;
        cleanRemarks = cleanRemarks.replace(/\[END:[^\]]+\]\s*/g, '').trim();
      }
    }

    return {
      ...e,
      name: e.subject,
      date: e.event_date,
      time: displayTime,
      remarks: cleanRemarks,
      raw_remarks: e.remarks,
      isActive: e.is_active && (!e.activated_at || (new Date() - new Date(e.activated_at)) < 8 * 3600 * 1000),
      isExpired: e.activated_at && (new Date() - new Date(e.activated_at)) >= 8 * 3600 * 1000,
      type: e.event_type,
      leaders: e.event_assignments?.map(a => a.users?.full_name).filter(Boolean) || []
    };
  });
};

export const saveEvent = async (eventData) => {
  // Ensure event_time is valid PostgreSQL TIME format (e.g. "09:00")
  let cleanTime = (eventData.startTime || eventData.time || '09:00').toString().trim();
  if (cleanTime.includes(' - ')) {
    cleanTime = cleanTime.split(' - ')[0].trim();
  }
  if (cleanTime.includes(' to ')) {
    cleanTime = cleanTime.split(' to ')[0].trim();
  }
  cleanTime = cleanTime.substring(0, 5);

  let eventRemarks = eventData.remarks || '';
  if (eventData.type === 'Training' && eventData.endTime) {
    const endTag = `[END:${eventData.endTime.substring(0, 5)}]`;
    if (!eventRemarks.includes('[END:')) {
      eventRemarks = eventRemarks ? `${eventRemarks}\n${endTag}` : endTag;
    } else {
      eventRemarks = eventRemarks.replace(/\[END:[^\]]+\]/, endTag);
    }
  }

  // 1. Create the event
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .insert([{
      subject: eventData.name,
      event_type: eventData.type,
      event_date: eventData.date,
      event_time: cleanTime,
      venue: eventData.venue,
      room: eventData.room,
      department: eventData.department,
      created_by: eventData.created_by,
      remarks: eventRemarks,
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
      if (!leaderName || !leaderName.trim()) continue;
      const trimmed = leaderName.trim();
      const { data: users, error: uErr } = await supabase
        .from('users')
        .select('staff_id')
        .or(`staff_id.eq."${trimmed}",full_name.ilike."${trimmed}"`)
        .limit(1);

      if (uErr) console.error('Error finding leader in saveEvent:', trimmed, uErr);
      const leader = users && users.length > 0 ? users[0] : null;
      if (leader) {
        assignments.push({
          event_id: event.id,
          user_id: leader.staff_id,
          assigned_role: eventData.type === 'Training' ? 'instructor' : 'chairman'
        });
      } else {
        console.warn('Leader not found for assignment:', trimmed);
      }
    }
    if (assignments.length > 0) {
      const { error: insErr } = await supabase.from('event_assignments').insert(assignments);
      if (insErr) console.error('Error inserting event_assignments in saveEvent:', insErr);
    }
  }

  return { ...event, name: event.subject };
};

export const updateEventInfo = async (eventId, eventData) => {
  let cleanTime = (eventData.startTime || eventData.time || '09:00').toString().trim();
  if (cleanTime.includes(' - ')) {
    cleanTime = cleanTime.split(' - ')[0].trim();
  }
  if (cleanTime.includes(' to ')) {
    cleanTime = cleanTime.split(' to ')[0].trim();
  }
  cleanTime = cleanTime.substring(0, 5);

  let eventRemarks = eventData.remarks;
  if (eventData.type === 'Training' && eventData.endTime) {
    const endTag = `[END:${eventData.endTime.substring(0, 5)}]`;
    if (eventRemarks) {
      if (!eventRemarks.includes('[END:')) {
        eventRemarks = `${eventRemarks}\n${endTag}`;
      } else {
        eventRemarks = eventRemarks.replace(/\[END:[^\]]+\]/, endTag);
      }
    } else {
      eventRemarks = endTag;
    }
  }

  const updatePayload = {
    subject: eventData.name,
    event_type: eventData.type,
    event_date: eventData.date,
    event_time: cleanTime,
    venue: eventData.venue,
    room: eventData.room,
    department: eventData.department
  };
  if (eventRemarks !== undefined) {
    updatePayload.remarks = eventRemarks;
  }

  // 1. Update the event
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .update(updatePayload)
    .eq('id', eventId)
    .select()
    .maybeSingle();

  if (eventErr) {
    console.error('Error updating event:', eventErr);
    throw eventErr;
  }

  // 2. Re-assign leaders
  if (eventData.leaders) {
    // Delete existing
    const { error: delErr } = await supabase.from('event_assignments').delete().eq('event_id', eventId);
    if (delErr) console.error('Error deleting previous event_assignments:', delErr);

    // Insert new
    if (eventData.leaders.length > 0) {
      const assignments = [];
      for (const leaderName of eventData.leaders) {
        if (!leaderName || !leaderName.trim()) continue;
        const trimmed = leaderName.trim();
        const { data: users, error: uErr } = await supabase
          .from('users')
          .select('staff_id')
          .or(`staff_id.eq."${trimmed}",full_name.ilike."${trimmed}"`)
          .limit(1);

        if (uErr) console.error('Error finding leader in updateEventInfo:', trimmed, uErr);
        const leader = users && users.length > 0 ? users[0] : null;
        if (leader) {
          assignments.push({
            event_id: eventId,
            user_id: leader.staff_id,
            assigned_role: eventData.type === 'Training' ? 'instructor' : 'chairman'
          });
        } else {
          console.warn('Leader not found for assignment in updateEventInfo:', trimmed);
        }
      }
      if (assignments.length > 0) {
        const { error: insErr } = await supabase.from('event_assignments').insert(assignments);
        if (insErr) console.error('Error inserting new event_assignments:', insErr);
      }
    }
  }

  return { ...event, name: event?.subject };
};

export const getEvent = async (id) => {
  if (!id) {
    const all = await getAllEvents();
    return all[0] || null;
  }

  const { data, error } = await supabase
    .from('events')
    .select('*, event_assignments(user_id, assigned_role, users(full_name, staff_id, loa_no)), users!events_created_by_fkey(full_name, staff_id)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  let displayTime = data.event_time ? data.event_time.substring(0, 5) : '';
  let cleanRemarks = data.remarks || '';
  if (data.event_type === 'Training' && cleanRemarks.includes('[END:')) {
    const match = cleanRemarks.match(/\[END:([^\]]+)\]/);
    if (match && match[1]) {
      displayTime = `${displayTime} - ${match[1].trim()}`;
      cleanRemarks = cleanRemarks.replace(/\[END:[^\]]+\]\s*/g, '').trim();
    }
  }

  return {
    ...data,
    name: data.subject,
    date: data.event_date,
    time: displayTime,
    remarks: cleanRemarks,
    raw_remarks: data.remarks,
    isActive: data.is_active && (!data.activated_at || (new Date() - new Date(data.activated_at)) < 8 * 3600 * 1000),
    isExpired: data.activated_at && (new Date() - new Date(data.activated_at)) >= 8 * 3600 * 1000,
    type: data.event_type,
    creator: data.users ? { name: data.users.full_name, staff_id: data.users.staff_id } : null,
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
    .maybeSingle();

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
    .maybeSingle();

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

// --- TRAINING ANALYTICS ---

export const getTrainingAnalytics = async (filters = {}) => {
  const { data: events, error } = await supabase
    .from('events')
    .select('*, event_assignments(user_id, assigned_role, users(full_name, staff_id, loa_no)), event_signatures(id)')
    .eq('event_type', 'Training')
    .order('event_date', { ascending: false });

  if (error) {
    console.error('Error fetching training analytics:', error);
    return {
      instructors: [],
      totals: { totalHours: 0, totalSessions: 0, totalInstructors: 0, avgHoursPerInstructor: 0 },
      events: []
    };
  }

  // Helper inside db for time parsing
  const parseHours = (timeStr, remarks = '') => {
    if (!timeStr) return 0;
    let start = '', end = '';
    if (timeStr.includes(' - ')) {
      [start, end] = timeStr.split(' - ').map(s => s.trim());
    } else if (timeStr.includes(' to ')) {
      [start, end] = timeStr.split(' to ').map(s => s.trim());
    } else if (remarks && typeof remarks === 'string' && remarks.includes('[END:')) {
      const match = remarks.match(/\[END:([^\]]+)\]/);
      if (match && match[1]) {
        start = timeStr.substring(0, 5);
        end = match[1].trim().substring(0, 5);
      } else {
        return 0;
      }
    } else {
      return 0; // Single time, default 0
    }
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
    let mins = (eH * 60 + eM) - (sH * 60 + sM);
    if (mins < 0) mins += 24 * 60;
    return Math.round((mins / 60) * 100) / 100;
  };

  const instructorMap = {};
  let overallTotalHours = 0;
  const processedEvents = [];

  events.forEach(e => {
    // Apply filters if provided
    if (filters.department && filters.department !== 'ALL') {
      if (e.department !== filters.department) return;
    } else if (filters.allowedDepartments && filters.allowedDepartments.length > 0) {
      if (!filters.allowedDepartments.includes(e.department)) return;
    }
    if (filters.startDate && e.event_date < filters.startDate) {
      return;
    }
    if (filters.endDate && e.event_date > filters.endDate) {
      return;
    }
    if (filters.monthYear) {
      // Format YYYY-MM
      const eventMY = e.event_date?.substring(0, 7);
      if (eventMY !== filters.monthYear) return;
    }

    let displayTime = e.event_time ? e.event_time.substring(0, 5) : '';
    if (e.remarks && e.remarks.includes('[END:')) {
      const m = e.remarks.match(/\[END:([^\]]+)\]/);
      if (m && m[1]) displayTime = `${displayTime} - ${m[1].trim()}`;
    }

    const duration = parseHours(e.event_time, e.remarks);
    overallTotalHours += duration;

    const eventObj = {
      id: e.id,
      name: e.subject,
      date: e.event_date,
      time: displayTime,
      duration,
      venue: e.venue,
      room: e.room,
      department: e.department,
      participantsCount: e.event_signatures?.length || 0,
      instructors: e.event_assignments?.map(a => a.users?.full_name).filter(Boolean) || []
    };
    processedEvents.push(eventObj);

    // Aggregate by assigned instructors
    (e.event_assignments || []).forEach(a => {
      const u = a.users;
      if (!u) return;

      const key = u.staff_id || u.full_name;
      if (!instructorMap[key]) {
        instructorMap[key] = {
          staff_id: u.staff_id,
          name: u.full_name,
          loa_no: u.loa_no || '-',
          totalHours: 0,
          totalSessions: 0,
          sessions: []
        };
      }

      instructorMap[key].totalHours += duration;
      instructorMap[key].totalHours = Math.round(instructorMap[key].totalHours * 100) / 100;
      instructorMap[key].totalSessions += 1;
      instructorMap[key].sessions.push(eventObj);
    });
  });

  const instructors = Object.values(instructorMap).sort((a, b) => b.totalHours - a.totalHours);
  const totalInstructors = instructors.length;
  const avgHours = totalInstructors > 0 ? Math.round((overallTotalHours / totalInstructors) * 100) / 100 : 0;

  return {
    instructors,
    totals: {
      totalHours: Math.round(overallTotalHours * 100) / 100,
      totalSessions: processedEvents.length,
      totalInstructors,
      avgHoursPerInstructor: avgHours
    },
    events: processedEvents
  };
};

