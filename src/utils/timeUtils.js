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

export const parseEventTime = (timeStr, remarks = '') => {
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
  
  const cleanStart = timeStr.substring(0, 5);

  // Check if remarks contains [END:HH:mm] tag
  if (remarks && typeof remarks === 'string' && remarks.includes('[END:')) {
    const match = remarks.match(/\[END:([^\]]+)\]/);
    if (match && match[1]) {
      const cleanEnd = match[1].trim().substring(0, 5);
      const duration = calculateDurationHours(cleanStart, cleanEnd);
      return { startTime: cleanStart, endTime: cleanEnd, duration };
    }
  }
  
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

/**
 * Calculates whether event activation is locked for assigned instructors.
 * For Training events scheduled in advance, activation opens 30 minutes before the start time.
 * 
 * @param {Object} event - Event object containing type, date, time, remarks, etc.
 * @param {number} lockMinutesBefore - Minutes before start time when activation becomes unlocked (default: 30)
 * @param {Date} [currentTime] - Current time (defaults to new Date())
 * @returns {Object} { isLocked, unlockDateTime, startDateTime, timeRemainingStr, formattedUnlockTime }
 */
export const getActivationLockStatus = (event, lockMinutesBefore = 30, currentTime = new Date()) => {
  if (!event || event.type !== 'Training' || !event.date) {
    return {
      isLocked: false,
      unlockDateTime: null,
      startDateTime: null,
      timeRemainingStr: '',
      formattedUnlockTime: ''
    };
  }

  // Parse start time (e.g., "09:00" from "09:00 - 17:00" or event.event_time)
  let startTime = '';
  if (event.time) {
    const parsed = parseEventTime(event.time, event.remarks || event.raw_remarks || '');
    startTime = parsed.startTime;
  }
  if (!startTime && event.event_time) {
    startTime = event.event_time.substring(0, 5);
  }
  if (!startTime) {
    startTime = '00:00';
  }

  // Parse event.date: Expected format "YYYY-MM-DD"
  const dateParts = event.date.split('-');
  if (dateParts.length !== 3) {
    return {
      isLocked: false,
      unlockDateTime: null,
      startDateTime: null,
      timeRemainingStr: '',
      formattedUnlockTime: ''
    };
  }

  const [year, month, day] = dateParts.map(Number);
  const [hours, minutes] = (startTime || '00:00').split(':').map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    return {
      isLocked: false,
      unlockDateTime: null,
      startDateTime: null,
      timeRemainingStr: '',
      formattedUnlockTime: ''
    };
  }

  // Construct start date time in local timezone
  const startDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const unlockDateTime = new Date(startDateTime.getTime() - lockMinutesBefore * 60 * 1000);

  const now = currentTime instanceof Date ? currentTime : new Date();
  const diffMs = unlockDateTime.getTime() - now.getTime();
  const isLocked = diffMs > 0;

  let timeRemainingStr = '';
  if (isLocked) {
    const totalMinutes = Math.ceil(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const remHours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const remMins = totalMinutes % 60;

    if (days > 0) {
      timeRemainingStr = `${days}d ${remHours}h`;
    } else if (remHours > 0) {
      timeRemainingStr = `${remHours}h ${remMins}m`;
    } else {
      timeRemainingStr = `${remMins}m`;
    }
  }

  const dateOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };

  const formattedDate = unlockDateTime.toLocaleDateString('en-GB', dateOptions);
  const formattedTime = unlockDateTime.toLocaleTimeString('en-GB', timeOptions);
  const formattedUnlockTime = `${formattedDate} at ${formattedTime}`;

  return {
    isLocked,
    unlockDateTime,
    startDateTime,
    timeRemainingStr,
    formattedUnlockTime
  };
};
