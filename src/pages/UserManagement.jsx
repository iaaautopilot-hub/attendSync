import React, { useState, useEffect } from 'react';
import { getAllUsers, addUser, deleteUser, updateUser, getCurrentUser, getAllDepartments } from '../db';
import { UserPlus, Shield, Trash2, Users, Edit, Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword]);
  
  const initialFormState = {
    name: '',
    email: '',
    password: '123',
    multi_roles: ['Chairman'],
    loaNo: '',
    staffId: '',
    adminDepartment: 'Flight Operation'
  };
  
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState(initialFormState);

  const loadData = async () => {
    setLoading(true);
    const [fetchedUsers, fetchedDepts] = await Promise.all([
      getAllUsers(),
      getAllDepartments()
    ]);
    setUsers(fetchedUsers);
    setDepartments(fetchedDepts);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const u = await getCurrentUser();
      setCurrentUser(u);
      if (u?.multi_roles?.some(r => ['system administrator', 'admin'].includes(r.toLowerCase()))) {
        await loadData();
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return null;

  if (!currentUser?.multi_roles?.some(r => ['system administrator', 'admin'].includes(r.toLowerCase()))) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    if (!formData.multi_roles || formData.multi_roles.length === 0) {
      alert("Please select at least one role.");
      return;
    }

    let payloadRoles = [...formData.multi_roles];
    if (payloadRoles.includes('Admin')) {
      payloadRoles.push(`dept:${formData.adminDepartment}`);
    }

    const payload = { ...formData, multi_roles: payloadRoles };

    let result;
    if (editingUserId) {
      result = await updateUser({ ...payload, original_staff_id: editingUserId });
      if (!result.error) setEditingUserId(null);
    } else {
      result = await addUser(payload);
    }

    if (result?.error) {
      alert("Error: " + result.error.message);
    } else {
      setFormData(initialFormState);
      setIsModalOpen(false);
      await loadData();
    }
  };

  const handleEditUser = (user) => {
    setEditingUserId(user.staff_id); 
    
    let roles = user.multi_roles || [user.role];
    let adminDept = 'Flight Operation';
    const deptRole = roles.find(r => r.startsWith('dept:'));
    if (deptRole) {
      adminDept = deptRole.split(':')[1];
      roles = roles.filter(r => r !== deptRole);
    }

    setFormData({
      name: user.name,
      staffId: user.staff_id || '',
      email: user.email || '',
      password: '123',
      multi_roles: roles,
      adminDepartment: adminDept,
      loaNo: user.loa_no || '',
      original_staff_id: user.staff_id
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setFormData(initialFormState);
  };

  const handleDeleteUser = async (staffId) => {
    const userToDelete = users.find(u => u.staff_id === staffId);
    if (userToDelete?.username?.toLowerCase() === 'admin' || staffId === 'ADMIN-01') {
      alert("CRITICAL ERROR: The System Administrator account cannot be removed.");
      return;
    }
    
    if (window.confirm("Are you sure you want to delete this user?")) {
      const { error } = await deleteUser(staffId);
      if (error) {
        alert("Error deleting user: " + error.message);
      } else {
        await loadData();
      }
    }
  };

  const filteredUsers = users.filter(user => 
    !searchKeyword || 
    user.name?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
    user.staff_id?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openModal = () => setIsModalOpen(true);

  return (
    <div className="animate-fade-in">
      <div className="glass-card" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Registered Staff</h3>
            <span className="badge badge-purple" style={{ background: 'var(--aa-red)', color: 'white' }}>{filteredUsers.length} Total</span>
          </div>
          <button onClick={openModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} /> Register New User
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-card" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0.75rem 1.5rem', background: 'rgba(255, 255, 255, 0.02)' }}>
            <Search size={20} style={{ color: 'var(--text-secondary)', marginRight: '1rem' }} />
            <input
              type="text"
              placeholder="Search by name, staff ID, or email..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Staff ID</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Roles</th>
                <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.staff_id || user.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'all 0.3s ease' }} className="user-row-hover">
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{user.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{user.staff_id}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{user.email || 'No Email'}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {user.multi_roles?.filter(r => !r.startsWith('dept:')).map(r => (
                        <span key={r} className={`badge ${r.toLowerCase() === 'admin' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem' }}>
                          {r}
                        </span>
                      ))}
                      {user.multi_roles?.find(r => r.startsWith('dept:')) && (
                        <span className="badge badge-purple" style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                          Dept: {user.multi_roles.find(r => r.startsWith('dept:')).split(':')[1]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleEditUser(user)} 
                        className="btn btn-outline" 
                        style={{ padding: '0.4rem', border: 'none', color: 'var(--text-secondary)' }}
                        title="Edit User"
                      >
                        <Edit size={18} />
                      </button>
                      {currentUser?.multi_roles?.some(r => r.toLowerCase() === 'system administrator') && (
                        <button 
                          onClick={() => handleDeleteUser(user.staff_id)} 
                          className="btn btn-outline" 
                          style={{ 
                            padding: '0.4rem', 
                            color: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 'var(--text-secondary)' : '#F87171', 
                            border: 'none',
                            opacity: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 0.3 : 1,
                            cursor: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 'not-allowed' : 'pointer'
                          }}
                          disabled={user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01'}
                          title={user.username?.toLowerCase() === 'admin' ? "System Account Cannot Be Deleted" : "Delete User"}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && (
            <div className="empty-state" style={{ marginTop: '2rem' }}>
              <Users size={48} />
              <p>No users found matching your search.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
            <button 
              className="btn btn-outline" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '0.5rem 1rem' }}
            >
              Previous
            </button>
            <span style={{ color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className="btn btn-outline" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '0.5rem 1rem' }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: editingUserId ? 'rgba(245, 158, 11, 0.15)' : 'rgba(226, 22, 41, 0.15)', borderRadius: '16px', color: editingUserId ? '#F59E0B' : 'var(--aa-red)' }}>
                  <img src="/icon.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{editingUserId ? 'Edit User' : 'Register Staff'}</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>{editingUserId ? 'Modify staff credentials' : 'Register new staff into the AirAsia portal'}</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleSubmitUser}>
              <div className="form-group">
                <label>Full Name</label>
                <input required type="text" name="name" className="form-control" value={formData.name} onChange={handleChange} placeholder="e.g. David Manager" />
              </div>

              <div className="form-group">
                <label>Staff ID</label>
                <input required type="text" name="staffId" className="form-control" value={formData.staffId} onChange={handleChange} placeholder="e.g. 1003668" />
                {editingUserId && <span style={{ fontSize: '0.65rem', color: 'var(--aa-red)', marginTop: '0.25rem', display: 'block' }}>NOTE: CHANGING STAFF ID WILL UPDATE ALL HISTORICAL LINKS.</span>}
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Email Address</label>
                <input required type="email" name="email" className="form-control" value={formData.email} onChange={handleChange} placeholder="david@airasia.com" />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Roles</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {['Chairman', 'Instructor', 'Admin', 'System Administrator'].map(r => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                      <input 
                        type="checkbox" 
                        checked={formData.multi_roles?.includes(r)}
                        onChange={(e) => {
                          const currentRoles = formData.multi_roles || [];
                          if (e.target.checked) {
                            setFormData({ ...formData, multi_roles: [...currentRoles, r] });
                          } else {
                            setFormData({ ...formData, multi_roles: currentRoles.filter(role => role !== r) });
                          }
                        }}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--aa-red)' }}
                      />
                      {r}
                    </label>
                  ))}
                </div>
                {(!formData.multi_roles || formData.multi_roles.length === 0) && <span style={{ color: 'var(--aa-red)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>Please select at least one role.</span>}
              </div>

              {formData.multi_roles?.includes('Admin') && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Admin Department View Limit</label>
                  <select name="adminDepartment" className="form-control" value={formData.adminDepartment} onChange={handleChange}>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>This Admin will only see events belonging to this department.</span>
                </div>
              )}

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>LOA Number (For Instructors/Chairmen)</label>
                <input type="text" name="loaNo" className="form-control" value={formData.loaNo} onChange={handleChange} placeholder="e.g. 5850/KAPEL/II/2026" />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <Shield size={20} />
                  {editingUserId ? 'Update User' : 'Register User'}
                </button>
                <button type="button" onClick={closeModal} className="btn btn-outline" style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
