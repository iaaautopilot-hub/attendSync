import { isFlightOperationIntegrated } from './departmentUtils';

/**
 * Formats standard company event record number: IAA/{deptCode}/{typeCode}/{year}/{numericId}
 * Bulletproof against null/empty/0 event_code: guarantees 00000 is NEVER displayed.
 */
export const formatEventRecordNumber = (event, deptCodeMap = {}) => {
  if (!event) return 'N/A';

  const dept = event.department || 'Flight Operation';
  let dCode = deptCodeMap[dept];
  if (!dCode) {
    if (dept === 'Flight Operation' || dept === 'FOP') dCode = 'FOP';
    else if (isFlightOperationIntegrated(dept)) dCode = 'FOPI';
    else dCode = dept.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 4);
  }

  // Extract clean positive sequential number from event_code (e.g. EV-0290 -> 00290)
  let numericId = '';
  if (event.event_code) {
    const digits = event.event_code.replace(/\D/g, '');
    if (digits && parseInt(digits, 10) > 0) {
      numericId = digits.padStart(5, '0');
    }
  }

  // Fallback: If event_code is null or resolved to 00000, use deterministic positive hash from event.id
  if (!numericId || numericId === '00000') {
    if (event.id) {
      const hash = Math.abs(
        event.id.toString().split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
      ) % 100000;
      numericId = String(hash || 1).padStart(5, '0');
    } else {
      numericId = '00001';
    }
  }

  // Safe year extraction
  let year = new Date().getFullYear();
  if (event.date || event.event_date) {
    const parsedYear = new Date(event.date || event.event_date).getFullYear();
    if (!isNaN(parsedYear)) {
      year = parsedYear;
    }
  }

  const isTraining = (event.type === 'Training' || event.event_type === 'Training');
  const typeCode = isTraining ? 'TRG' : 'MTG';

  return `IAA/${dCode}/${typeCode}/${year}/${numericId}`;
};
