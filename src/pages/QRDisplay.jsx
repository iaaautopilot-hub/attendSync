import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getEvent } from '../db';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';

const QRDisplay = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const currentEvent = await getEvent(eventId);
      if (currentEvent) {
        setEvent(currentEvent);
      }
    };
    fetchEvent();
  }, [eventId]);

  if (!event || !event.isActive) {
    const isExpired = event?.isExpired;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#050505', color: '#fff', fontFamily: 'var(--font-main)' }}>
        <div className="glass-card" style={{ textAlign: 'center', border: isExpired ? '1px solid var(--aa-red)' : 'none' }}>
          <h2 style={{ color: 'var(--aa-red)', marginBottom: '1rem' }}>{isExpired ? 'QR Code Expired' : 'QR Code Unavailable'}</h2>
          <p>{isExpired 
            ? 'This attendance session has ended (8-hour limit reached).' 
            : 'The Instructor or Chairman must activate the event before the QR code can be displayed.'}
          </p>
        </div>
      </div>
    );
  }

  const attendanceLink = `${window.location.origin}/attend/${event.id}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: 'var(--font-main)' }}>
      <div style={{ padding: '3rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800', background: 'linear-gradient(135deg, #FFFFFF, var(--aa-red))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {event.name}
        </h1>
        
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', color: '#A0A0A0', fontSize: '1.25rem', marginBottom: '2rem', fontWeight: '500' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={24} style={{ color: 'var(--aa-red)' }} /> {event.date} {event.time && `• ${event.time}`}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={24} style={{ color: 'var(--aa-red)' }} /> {event.venue} ({event.room})
          </span>
        </div>

        <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '30px', boxShadow: '0 20px 40px rgba(226, 22, 41, 0.2)', display: 'inline-block', border: '6px solid #FFFFFF' }}>
          <QRCodeSVG value={attendanceLink} size={300} level="H" />
        </div>
        
        <div style={{ marginTop: '2rem', fontSize: '1.25rem', color: '#FFFFFF' }}>
          <p style={{ margin: '0 0 1rem 0', opacity: 0.8, fontWeight: '300' }}>Scan to join the attendance session</p>
          <a href={attendanceLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--aa-red)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '700' }}>
            {attendanceLink} <ExternalLink size={20} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default QRDisplay;
