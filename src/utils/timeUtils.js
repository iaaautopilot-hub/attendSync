/**
 * Utility functions for calculating and parsing event times and training hours
 */

export const calculateDurationHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;
  
  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  // Handle crossing midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  
  const diffMinutes = endMinutes - startMinutes;
  const hours = diffMinutes / 60;
  return Math.round(hours * 100) / 100;
};

export const parseEventTime = (timeStr) => {
  if (!timeStr) return { startTime: '', endTime: '', duration: 0 };
  
  // Format: "09:00 - 17:00" or "09:00 to 17:00"
  if (timeStr.includes(' - ')) {
    const [start, end] = timeStr.split(' - ').map(s => s.trim());
    const cleanStart = start.substring(0, 5);
    const cleanEnd = end.substring(0, 5);
    const duration = calculateDurationHours(cleanStart, cleanEnd);
    return { startTime: cleanStart, endTime: cleanEnd, duration };
  } else if (timeStr.includes(' to ')) {
    const [start, end] = timeStr.split(' to ').map(s => s.trim());
    const cleanStart = start.substring(0, 5);
    const cleanEnd = end.substring(0, 5);
    const duration = calculateDurationHours(cleanStart, cleanEnd);
    return { startTime: cleanStart, endTime: cleanEnd, duration };
  }
  
  // Single time (e.g. "14:00:00" or "14:00")
  const cleanStart = timeStr.substring(0, 5);
  return { startTime: cleanStart, endTime: '', duration: 0 };
};

export const formatDurationDisplay = (hours) => {
  if (!hours || hours <= 0) return '0 hrs';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} ${h === 1 ? 'hr' : 'hrs'}`;
  if (h === 0) return `${m} mins`;
  return `${h}h ${m}m`;
};
