/**
 * Utility functions for Department access control and role-based matching
 */

// Normalized string comparison helper
export const normalizeDept = (dept) => (dept || '').trim().toLowerCase();

/**
 * Check if a department string represents "Flight Operation Integrated"
 */
export const isFlightOperationIntegrated = (dept) => {
  const norm = normalizeDept(dept);
  if (!norm) return false;
  return (
    norm === 'flight operation integrated' ||
    norm === 'flight operations integrated' ||
    norm === 'flight operation integration' ||
    norm === 'flight operations integration' ||
    norm === 'fop integrated' ||
    norm === 'fopi' ||
    (norm.includes('flight op') && norm.includes('integrated')) ||
    (norm.includes('fop') && norm.includes('integrated')) ||
    (norm.includes('flight') && norm.includes('integrated'))
  );
};

/**
 * Check if a department string represents Flight Operation / Flight Ops
 */
export const isFlightOpsDept = (dept) => {
  const norm = normalizeDept(dept);
  if (!norm) return false;
  if (isFlightOperationIntegrated(dept)) return false;
  return (
    norm === 'flight operation' ||
    norm === 'flight operations' ||
    norm === 'flight ops' ||
    norm === 'fop' ||
    norm.startsWith('flight op') ||
    norm === 'pilot'
  );
};

/**
 * Check if a department string represents Cabin Crew / Cabin Operations
 */
export const isCabinCrewDept = (dept) => {
  const norm = normalizeDept(dept);
  if (!norm) return false;
  if (isFlightOperationIntegrated(dept)) return false;
  return (
    norm === 'cabin crew' ||
    norm === 'cabin operations' ||
    norm === 'cabin ops' ||
    norm === 'cabin' ||
    norm === 'cc' ||
    norm.includes('cabin')
  );
};

/**
 * Check if an admin with a given adminDepartment has access to an event in eventDepartment
 */
export const canAdminAccessDepartment = (adminDept, eventDept) => {
  if (!adminDept || !eventDept) return false;
  const normAdmin = normalizeDept(adminDept);
  const normEvent = normalizeDept(eventDept);

  // Exact or normalized match
  if (normAdmin === normEvent) return true;

  // Integrated Flight Operation event allows Flight Ops, Cabin Crew, and Integrated admins
  if (isFlightOperationIntegrated(eventDept)) {
    if (isFlightOpsDept(adminDept) || isCabinCrewDept(adminDept) || isFlightOperationIntegrated(adminDept)) {
      return true;
    }
  }

  // Handle aliases for Flight Ops
  if (isFlightOpsDept(adminDept) && isFlightOpsDept(eventDept)) {
    return true;
  }

  // Handle aliases for Cabin Crew
  if (isCabinCrewDept(adminDept) && isCabinCrewDept(eventDept)) {
    return true;
  }

  return false;
};

/**
 * Check if a user can view or edit a given event
 */
export const canUserViewOrEditEvent = (user, event) => {
  if (!user || !event) return false;

  // System Administrator can view and edit everything
  if (user.multi_roles?.some(r => r.toLowerCase() === 'system administrator')) {
    return true;
  }

  // If user is Admin
  if (user.multi_roles?.some(r => r.toLowerCase() === 'admin')) {
    const deptRole = user.multi_roles.find(r => r.startsWith('dept:'));
    if (deptRole) {
      const adminDept = deptRole.split(':')[1];
      return canAdminAccessDepartment(adminDept, event.department);
    }
    return false;
  }

  // Chairmen / Instructors check
  if (event.leaders && (event.leaders.includes(user.name) || event.leaders.includes(user.full_name))) {
    return true;
  }

  return false;
};

/**
 * Get list of allowed departments for an admin user to choose when creating/editing events
 */
export const getAllowedDepartmentsForUser = (user, allDepartments) => {
  if (!user || !allDepartments) return [];

  // System Admin can select all
  if (user.multi_roles?.some(r => r.toLowerCase() === 'system administrator')) {
    return allDepartments;
  }

  // If user is Admin
  if (user.multi_roles?.some(r => r.toLowerCase() === 'admin')) {
    const deptRole = user.multi_roles.find(r => r.startsWith('dept:'));
    if (!deptRole) return [];
    const adminDept = deptRole.split(':')[1];

    if (isFlightOpsDept(adminDept)) {
      return allDepartments.filter(d => isFlightOpsDept(d.name) || isFlightOperationIntegrated(d.name));
    }
    if (isCabinCrewDept(adminDept)) {
      return allDepartments.filter(d => isCabinCrewDept(d.name) || isFlightOperationIntegrated(d.name));
    }
    if (isFlightOperationIntegrated(adminDept)) {
      return allDepartments.filter(d => isFlightOperationIntegrated(d.name) || isFlightOpsDept(d.name) || isCabinCrewDept(d.name));
    }
    return allDepartments.filter(d => normalizeDept(d.name) === normalizeDept(adminDept));
  }

  return [];
};
