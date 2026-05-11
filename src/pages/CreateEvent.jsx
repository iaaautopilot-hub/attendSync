import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveEvent, getUsersByRole, getAllUsers } from '../db';
import { Rocket, Users, Target } from 'lucide-react';

const CreateEvent = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    type: 'Meeting',
    venue: '',
    room: '',
    department: 'Flight Operation',
    leaders: [''] // Up to 3
  });

  const DEPARTMENTS = [
    "Flight Operation",
    "Engineering",
    "Cabin Crew",
    "Ground Operations",
    "Commercial",
    "Information, Commercial and technology",
    "Facilities Management",
    "Corporate Quality Assurance",
    "Safety"
  ];
  const [availableLeaders, setAvailableLeaders] = useState([]);

  useEffect(() => {
    const fetchLeaders = async () => {
      const requiredRole = formData.type === 'Training' ? 'Instructor' : 'Chairman';
      const users = await getUsersByRole(requiredRole);
      setAvailableLeaders(users);
    };
    fetchLeaders();

    setFormData(prev => ({
      ...prev,
      leaders: ['']
    }));
  }, [formData.type]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLeaderChange = (index, value) => {
    const newLeaders = [...formData.leaders];
    newLeaders[index] = value;
    setFormData({ ...formData, leaders: newLeaders });
  };

  const addLeader = () => {
    if (formData.leaders.length < 3) {
      setFormData({ ...formData, leaders: [...formData.leaders, ''] });
    }
  };

  const removeLeader = (index) => {
    if (formData.leaders.length > 1) {
      const newLeaders = formData.leaders.filter((_, i) => i !== index);
      setFormData({ ...formData, leaders: newLeaders });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const actualLeaders = formData.leaders.filter(l => l.trim() !== '');
    const event = await saveEvent({
      ...formData,
      leaders: actualLeaders
    });

    // Simulate Email Notification to the first Chairman/Instructor
    if (actualLeaders.length > 0) {
      const primaryLeaderName = actualLeaders[0];
      const allUsers = await getAllUsers();
      const primaryLeaderObj = allUsers.find(u => u.name === primaryLeaderName || u.full_name === primaryLeaderName);

      const email = primaryLeaderObj?.email || 'unknown@company.com';
      const eventLink = `${window.location.origin}/dashboard/${event.id}`;
      const leaderRole = event.type === 'Training' ? 'Instructor' : 'Chairman';
      const leaderName = primaryLeaderObj?.name || primaryLeaderObj?.full_name || 'Leader';

      // Mailto approach (Option 2)
      const subject = encodeURIComponent(`New Event Assignment - ${event.name}`);
      const body = encodeURIComponent(`Hi ${leaderName},\n\nYou have been assigned as the primary ${leaderRole} for "${event.name}".\n\nPlease log in to the portal via the link below to sign and officially open the event. Only then will the QR code for participant attendance be generated!\n\nAccess Link: ${eventLink}\n\nThank you.`);
      
      // Use Google Workspace (Gmail) Compose Link instead of mailto
      // This is perfect for AirAsia since you use Google Workspace!
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
      
      const mailtoLink = document.createElement('a');
      mailtoLink.href = gmailUrl;
      mailtoLink.target = '_blank'; // Opens Gmail in a new tab
      document.body.appendChild(mailtoLink);
      mailtoLink.click();
      document.body.removeChild(mailtoLink);
      
      // Navigate to dashboard after a delay
      setTimeout(() => {
        navigate(`/dashboard/${event.id}`);
      }, 1500);
      return;
    }

    // Navigate to dashboard automatically (if no leaders)
    navigate(`/dashboard/${event.id}`);
  };

  const leaderLabel = formData.type === 'Training' ? 'Instructor' : 'Chairman';

  return (
    <div className="animate-fade-in" style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '16px', color: 'var(--aa-red)', boxShadow: '0 8px 16px rgba(226, 22, 41, 0.1)' }}>
            <img src="/icon.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Create New Event</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Launch your meeting or training session with AirAsia AttendSync</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Event Name</label>
            <input required type="text" name="name" className="form-control" value={formData.name} onChange={handleChange} placeholder="e.g. Q3 Strategic Planning" />
          </div>

          <div className="form-group">
            <label>Event Type</label>
            <select name="type" className="form-control" value={formData.type} onChange={handleChange}>
              <option value="Meeting">Meeting</option>
              <option value="Training">Training</option>
            </select>
          </div>

          <div className="form-group">
            <label>Event Date</label>
            <input required type="date" name="date" className="form-control" value={formData.date} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Event Time</label>
            <input required type="time" name="time" className="form-control" value={formData.time} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Department</label>
            <select 
              name="department" 
              className="form-control" 
              value={formData.department} 
              onChange={handleChange}
              required
            >
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Venue</label>
            <input required type="text" name="venue" className="form-control" value={formData.venue} onChange={handleChange} placeholder="e.g. RedHouse" />
          </div>

          <div className="form-group">
            <label>Room Name</label>
            <input required type="text" name="room" className="form-control" value={formData.room} onChange={handleChange} placeholder="e.g. Conference Room A" />
          </div>


          <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '1.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={20} style={{ color: 'var(--aa-red)' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Assign {leaderLabel}</h3>
              </div>
              {formData.leaders.length < 3 && (
                <button type="button" onClick={addLeader} className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                  + Add {leaderLabel}
                </button>
              )}
            </div>

            {formData.leaders.map((leader, index) => (
              <div key={index} style={{ display: 'flex', gap: '1rem', marginBottom: index !== formData.leaders.length - 1 ? '1rem' : '0' }}>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <select
                    required
                    className="form-control"
                    value={leader}
                    onChange={(e) => handleLeaderChange(index, e.target.value)}
                  >
                    <option value="" disabled>Select {leaderLabel}</option>
                    {availableLeaders.map((u) => (
                      <option key={u.staff_id || u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                {formData.leaders.length > 1 && (
                  <button type="button" onClick={() => removeLeader(index)} className="btn btn-outline" style={{ color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '1rem' }}>Assign up to 3 {leaderLabel.toLowerCase()}s for this event.</p>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}>
              <Target size={20} />
              Submit & Notify Leaders
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEvent;
