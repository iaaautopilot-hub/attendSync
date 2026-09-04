import React, { useState, useEffect } from 'react';
import { getAllUsers, addUser, deleteUser, updateUser, getCurrentUser, getAllDepartments } from '../db';
import { UserPlus, Shield, Trash2, Users, Edit, Search, X } from 'lucide-react';
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
    <div className="animate-fade-in" style={{ width: '100%', margin: '0 auto' }}>
      <div className="glass-card" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Registered Staff</h3>
            <span className="badge badge-purple" style={{ background: 'var(--aa-red)', color: 'white' }}>{filteredUsers.length} Total</span>
          </div>
          <button onClick={openModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}>
            <UserPlus size={18} /> Register New User
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 1.25rem', background: 'rgba(255, 255, 255, 0.02)' }}>
            <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '0.75rem', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by name, staff ID, or email..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.95rem', outline: 'none' }}
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="table-container">
          <table style={{ minWidth: '650px' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Staff ID</th>
                <th>Email</th>
                <th>Roles</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.staff_id || user.id}>
                  <td style={{ fontWeight: 600, color: 'var(--aa-white)' }}>{user.name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{user.staff_id}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user.email || 'No Email'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {user.multi_roles?.filter(r => !r.startsWith('dept:')).map(r => (
                        <span key={r} className={`badge ${r.toLowerCase() === 'admin' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                          {r}
                        </span>
                      ))}
                      {user.multi_roles?.find(r => r.startsWith('dept:')) && (
                        <span className="badge badge-purple" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                          Dept: {user.multi_roles.find(r => r.startsWith('dept:')).split(':')[1]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleEditUser(user)} 
                        className="btn btn-outline" 
                        style={{ padding: '0.35rem 0.5rem', border: 'none', color: 'var(--text-secondary)', minHeight: '34px' }}
                        title="Edit User"
                      >
                        <Edit size={16} />
                      </button>
                      {currentUser?.multi_roles?.some(r => r.toLowerCase() === 'system administrator') && (
                        <button 
                          onClick={() => handleDeleteUser(user.staff_id)} 
                          className="btn btn-outline" 
                          style={{ 
                            padding: '0.35rem 0.5rem', 
                            color: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 'var(--text-secondary)' : '#F87171', 
                            border: 'none',
                            opacity: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 0.3 : 1,
                            cursor: (user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01') ? 'not-allowed' : 'pointer',
                            minHeight: '34px'
                          }}
                          disabled={user.username?.toLowerCase() === 'admin' || user.staff_id === 'ADMIN-01'}
                          title={user.username?.toLowerCase() === 'admin' ? "System Account Cannot Be Deleted" : "Delete User"}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <Users size={40} />
              <p>No users found matching your search.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-outline" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            >
              Previous
            </button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className="btn btn-outline" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Staff Registration / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '800px', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem', margin: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.65rem', background: editingUserId ? 'rgba(245, 158, 11, 0.15)' : 'rgba(226, 22, 41, 0.15)', borderRadius: '12px', color: editingUserId ? '#F59E0B' : 'var(--aa-red)' }}>
                  <Users size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{editingUserId ? 'Edit Staff Member' : 'Register New Staff'}</h2>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {editingUserId ? 'Modify staff credentials, department access, or assigned roles' : 'Add new staff credentials to the portal'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={closeModal} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', padding: '0.35rem', cursor: 'pointer', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitUser}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                {/* Account Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--aa-red)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Account Details
                  </h4>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Full Name</label>
                    <input 
                      required 
                      type="text" 
                      name="name" 
                      className="form-control" 
                      value={formData.name} 
                      onChange={handleChange} 
                      placeholder="e.g. Capt. David Manager" 
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Staff ID / Username</label>
                    <input 
                      required 
                      type="text" 
                      name="staffId" 
                      className="form-control" 
                      value={formData.staffId} 
                      onChange={handleChange} 
                      placeholder="e.g. 1003668" 
                    />
                    {editingUserId && (
                      <span style={{ fontSize: '0.68rem', color: '#F59E0B', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ Changing Staff ID updates historical links.
                      </span>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Email Address</label>
                    <input 
                      required 
                      type="email" 
                      name="email" 
                      className="form-control" 
                      value={formData.email} 
                      onChange={handleChange} 
                      placeholder="e.g. david@airasia.com" 
                    />
                  </div>
                </div>

                {/* Roles & Permissions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--aa-red)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Roles & Permissions
                  </h4>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Select Assigned Roles</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                      {['Chairman', 'Instructor', 'Admin', 'System Administrator'].map(r => {
                        const isSelected = formData.multi_roles?.includes(r);
                        return (
                          <div
                            key={r}
                            onClick={() => {
                              const currentRoles = formData.multi_roles || [];
                              if (isSelected) {
                                setFormData({ ...formData, multi_roles: currentRoles.filter(role => role !== r) });
                              } else {
                                setFormData({ ...formData, multi_roles: [...currentRoles, r] });
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.65rem 0.75rem',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(226, 22, 41, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                              border: `1.5px solid ${isSelected ? 'var(--aa-red)' : 'var(--border-color)'}`,
                              transition: 'all 0.2s ease',
                              userSelect: 'none'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--aa-red)', pointerEvents: 'none' }}
                            />
                            <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--aa-white)' : 'var(--text-secondary)' }}>
                              {r}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {(!formData.multi_roles || formData.multi_roles.length === 0) && (
                      <span style={{ color: 'var(--aa-red)', fontSize: '0.7rem', marginTop: '0.35rem', display: 'block' }}>
                        * Please select at least one role.
                      </span>
                    )}
                  </div>

                  {formData.multi_roles?.includes('Admin') && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Admin Department View</label>
                      <select 
                        name="adminDepartment" 
                        className="form-control" 
                        value={formData.adminDepartment} 
                        onChange={handleChange}
                        style={{ fontSize: '0.88rem' }}
                      >
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.name}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>LOA Number (For Instructors/Chairmen)</label>
                    <input 
                      type="text" 
                      name="loaNo" 
                      className="form-control" 
                      value={formData.loaNo} 
                      onChange={handleChange} 
                      placeholder="e.g. 5850/KAPEL/II/2026" 
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.5, minWidth: '160px', padding: '0.8rem', fontSize: '0.95rem' }}>
                  <Shield size={16} />
                  {editingUserId ? 'Save Changes' : 'Register Staff Member'}
                </button>
                <button type="button" onClick={closeModal} className="btn btn-outline" style={{ flex: 1, minWidth: '120px', padding: '0.8rem' }}>
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
