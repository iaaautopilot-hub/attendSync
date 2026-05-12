import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, saveSignature, findUserByStaffId, checkAttendanceExists } from '../db';
import QRCode from 'qrcode';
import { CheckCircle, ClipboardList, ShieldCheck } from 'lucide-react';

const AttendanceForm = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    staffId: '',
    rank: '',
    hub: '',
    license: ''
  });

  useEffect(() => {
    const checkEvent = async () => {
      const currentEvent = await getEvent(eventId);
      if (currentEvent && String(currentEvent.id) === String(eventId)) {
        setEvent(currentEvent);
      } else {
        setEvent({ error: 'Event not found or has ended.' });
      }
    };
    checkEvent();
  }, [eventId]);

  const handleStaffIdBlur = async () => {
    if (formData.staffId) {
      const userData = await findUserByStaffId(formData.staffId);
      if (userData) {
        setFormData(prev => ({
          ...prev,
          name: userData.name || '',
          rank: userData.rank || '',
          hub: userData.hub || '',
          license: userData.license || ''
        }));
      }
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Check for duplicate submission
    const alreadySigned = await checkAttendanceExists(event.id, formData.staffId);
    if (alreadySigned) {
      alert("You have already signed in for this event.");
      setSubmitted(true);
      return;
    }
    
    // 2. Generate unique verification data for the QR code
    const verificationText = `EVENT: ${event.event_code || 'N/A'} | SUBJ: ${event.name} | DATE: ${event.date} | STAFF: ${formData.name} (${formData.staffId}) | VERIFIED BY ATTENDSYNC`;
    
    try {
      // Generate the QR code as a Data URL
      const qrDataUrl = await QRCode.toDataURL(verificationText, {
        margin: 1,
        width: 200,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      const success = await saveSignature({
        event_id: event.id,
        ...formData,
        signature: qrDataUrl // The QR code is now the signature
      });

      if (success) {
        setSubmitted(true);
      } else {
        alert("Attendance could not be saved. Please check the console.");
      }
    } catch (err) {
      console.error('QR Generation error:', err);
      alert("Failed to generate digital signature.");
    }
  };

  if (!event) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading event info...</div>;
  }

  if (event.error) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <div className="glass-card" style={{ display: 'inline-block' }}>
          <h2>Whoops!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{event.error}</p>
        </div>
      </div>
    );
  }

  if (event.isExpired) {
    return (
      <div className="container animate-fade-in" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <div className="glass-card" style={{ display: 'inline-block', border: '1px solid var(--aa-red)' }}>
          <h2 style={{ color: 'var(--aa-red)', fontSize: '2rem' }}>QR Code Expired</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>This attendance session has ended. It has been more than 8 hours since this event was activated.</p>
        </div>
      </div>
    );
  }

  if (!event.isActive) {
    return (
      <div className="container animate-fade-in" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <div className="glass-card" style={{ display: 'inline-block' }}>
          <h2>Event Not Ready!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Please hold on. The {event.type === 'Training' ? 'Instructor' : 'Chairman'} has not started this event yet.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        zIndex: 9999, 
        background: 'var(--aa-black)', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '2rem'
      }} className="animate-fade-in">
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 3rem', maxWidth: '500px', border: '1px solid var(--aa-red)' }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            background: 'rgba(226, 22, 41, 0.1)', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 2rem auto',
            color: 'var(--aa-red)'
          }}>
            <img src="/icon.png" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Attendance Recorded!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Thank you, <strong>{formData.name}</strong>. Your attendance for <span style={{ color: 'var(--aa-white)' }}>{event.name}</span> has been successfully recorded in the system.
          </p>
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, var(--aa-red), transparent)', margin: '2rem 0' }}></div>
          <p style={{ fontSize: '0.9rem', opacity: 0.6, letterSpacing: '0.05em' }}>YOU MAY NOW CLOSE THIS BROWSER TAB</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '650px', margin: '0 auto' }}>
      <div className="glass-card" style={{ marginBottom: '1.5rem', borderLeft: '6px solid var(--aa-red)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
          <img src="/icon.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Digital Attendance</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em' }}>You are signing in for:</p>
        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--aa-white)', fontSize: '1.5rem' }}>{event.name}</h3>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span>📅 {event.date} {event.time && `• ${event.time}`}</span>
          <span>📍 {event.venue} ({event.room})</span>
        </div>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit} className="grid grid-cols-2">
          <div className="form-group">
            <label>Staff ID</label>
            <input required type="text" name="staffId" className="form-control" value={formData.staffId} onChange={handleChange} onBlur={handleStaffIdBlur} placeholder="Enter ID to auto-fill" />
          </div>

          <div className="form-group">
            <label>Full Name</label>
            <input required type="text" name="name" className="form-control" value={formData.name} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Rank</label>
            <select required name="rank" className="form-control" value={formData.rank} onChange={handleChange}>
              <option value="" disabled>Select Rank</option>
              <option value="Captain">Captain</option>
              <option value="FOO">FOO</option>
              <option value="FO">FO</option>
              <option value="Senior Executive">Senior Executive</option>
              <option value="Executive">Executive</option>
              <option value="Manager">Manager</option>
              <option value="HOD">HOD</option>
              <option value="Direktur">Direktur</option>
              <option value="SCC">SCC</option>
              <option value="CC">CC</option>
              <option value="Instructor">Instructor</option>
              <option value="Lead Auditor">Lead Auditor</option>
              <option value="Auditor">Auditor</option>
              <option value="Other">Other</option>
              <option value="EFB Admin">EFB Admin</option>
              <option value="CPO">CPO</option>
              <option value="CPTS">CPTS</option>
              <option value="DGCA Inspector">DGCA Inspector</option>
              <option value="CCM">CCM</option>
              <option value="Safety Coordinator">Safety Coordinator</option>
              <option value="EFB Manager">EFB Manager</option>
            </select>
          </div>

          <div className="form-group">
            <label>HUB</label>
            <input required type="text" name="hub" className="form-control" value={formData.hub} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>License / Fac No./Other No.</label>
            <input required type="text" name="license" className="form-control" value={formData.license} onChange={handleChange} />
          </div>

          <div className="glass-card" style={{ gridColumn: '1 / -1', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--aa-green)', marginBottom: '0.5rem' }}>
              <ShieldCheck size={24} />
              <strong style={{ fontSize: '1.1rem' }}>Digital Verification Enabled</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              A unique, encrypted QR verification code will be automatically generated as your digital signature upon submission.
            </p>
          </div>

          <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}>
            Verify & Sign Attendance
          </button>
        </form>
      </div>
    </div>
  );
};

export default AttendanceForm;
