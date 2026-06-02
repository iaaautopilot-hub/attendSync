import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function testFilter() {
  const { data: users } = await supabase.from('users').select('username, multi_roles, full_name').eq('username', 'dewiindahmulyani');
  const user = users[0];
  console.log('User:', user.full_name, user.multi_roles);

  const { data: events } = await supabase.from('events').select('*, event_assignments(user_id, assigned_role, users(full_name))').order('created_at', { ascending: false });
  const allEvents = events.map(e => ({
    ...e,
    name: e.subject,
    department: e.department,
    leaders: e.event_assignments?.map(a => a.users?.full_name).filter(Boolean) || []
  }));

  console.log('Total Events:', allEvents.length);

  let filteredEvents = [];
  if (user.multi_roles?.some(r => r.toLowerCase() === 'system administrator')) {
    console.log('Is System Admin');
    filteredEvents = [...allEvents];
  } else if (user.multi_roles?.some(r => r.toLowerCase() === 'admin')) {
    console.log('Is Admin');
    const deptRole = user.multi_roles.find(r => r.startsWith('dept:'));
    if (deptRole) {
      const adminDept = deptRole.split(':')[1];
      console.log('Admin Dept:', adminDept);
      filteredEvents = allEvents.filter(e => e.department === adminDept);
    } else {
      console.log('No Admin Dept');
      filteredEvents = [];
    }
  } else {
    console.log('Is Instructor/Chairman');
    filteredEvents = allEvents.filter(e => e.leaders && e.leaders.includes(user.full_name));
  }

  console.log('Filtered Events Count:', filteredEvents.length);
  filteredEvents.forEach(e => console.log(' ->', e.name, '[', e.department, ']'));
}

testFilter();
