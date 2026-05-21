import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, clearEvent, getCurrentUser } from '../db';
import { Calendar, Trash2, ChevronRight, Target } from 'lucide-react';

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);

  const loadEvents = async () => {
    const u = await getCurrentUser();
    setUser(u);
    
    // If Admin, see all. If Chairman/Instructor, technically should only see their events.
    const allEvents = await getAllEvents();
    if (u?.multi_roles?.some(r => r.toLowerCase() === 'admin')) {
      setEvents([...allEvents]); 
    } else {
      // Filter events where the user is one of the leaders
      const myEvents = allEvents.filter(e => e.leaders && e.leaders.includes(u.full_name));
      setEvents(myEvents);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to permanently delete this event? This will also remove all its attendance records.")) {
      await clearEvent(id);
      loadEvents();
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '950px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '16px', color: 'var(--aa-red)', boxShadow: '0 8px 16px rgba(226, 22, 41, 0.1)' }}>
            <img src="/icon.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{user?.multi_roles?.some(r => r.toLowerCase() === 'admin') ? 'System Events' : 'My Assigned Events'}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Manage and view attendance records for your flight or training</p>
          </div>
        </div>
        {user?.multi_roles?.some(r => r.toLowerCase() === 'admin') && (
          <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
            + New Event
          </Link>
        )}
      </div>

      <div className="grid">
        {events.length === 0 ? (
          <div className="empty-state">
            <img src="/icon.png" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', marginBottom: '1.5rem', opacity: 0.6 }} />
            <h2>No Events Found</h2>
            <p>You do not have any active or past events assigned to you.</p>
          </div>
        ) : (
          events.map(event => (
            <Link 
              key={event.id} 
              to={`/dashboard/${event.id}`} 
              className="glass-card" 
              style={{ display: 'block', textDecoration: 'none', transition: 'transform 0.2s', padding: '1.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <span className={`badge ${event.type === 'Meeting' ? 'badge-blue' : 'badge-purple'}`}>
                      {event.type}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {event.date} {event.time && `• ${event.time}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
                    <h3 style={{ margin: 0 }}>{event.name}</h3>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.6rem', borderRadius: '6px', color: 'var(--aa-red)', border: '1px solid rgba(226, 22, 41, 0.2)', letterSpacing: '0.05em' }}>
                      { (() => {
                        const dept = (event.department || 'Flight Operation');
                        let dCode = 'FOP';
                        if (dept === 'Engineering') dCode = 'ENG';
                        else if (dept === 'Cabin Crew') dCode = 'CC';
                        else if (dept === 'Ground Operations') dCode = 'GND';
                        else if (dept === 'Commercial') dCode = 'COMM';
                        else if (dept.includes('technology') || dept === 'ICT') dCode = 'ICT';
                        else if (dept === 'Facilities Management') dCode = 'FM';
                        else if (dept === 'Corporate Quality Assurance') dCode = 'CQA';
                        else if (dept === 'Safety') dCode = 'SAF';
                        else if (dept !== 'Flight Operation' && dept !== 'FOP') {
                          dCode = dept.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3);
                        }
                        const nId = (event.event_code || '0').replace(/\D/g, '').padStart(5, '0');
                        return `IAA/${dCode}/${event.type === 'Training' ? 'TRG' : 'MTG'}/${new Date(event.date).getFullYear()}/${nId}`;
                      })() }
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem' }}>
                    <span>📍 {event.venue} ({event.room})</span>
                    <span>👔 Dept: {event.department}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  {user?.multi_roles?.some(r => r.toLowerCase() === 'admin') && (
                    <button 
                      onClick={(e) => handleDelete(event.id, e)} 
                      className="btn btn-outline" 
                      style={{ padding: '0.5rem', color: '#F87171', border: 'none' }}
                      title="Delete Event"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <ChevronRight size={24} style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default EventList;
