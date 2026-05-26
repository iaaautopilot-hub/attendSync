import React, { useState, useEffect } from 'react';
import { getAllDepartments, addDepartment, updateDepartment, deleteDepartment, getCurrentUser } from '../db';
import { Settings, Plus, Edit2, Trash2, X, Save } from 'lucide-react';

const ManageDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: ''
  });

  const fetchDepartments = async () => {
    setLoading(true);
    const depts = await getAllDepartments();
    setDepartments(depts);
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleOpenAdd = () => {
    setFormData({ name: '', code: '' });
    setIsEditing(false);
    setCurrentId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setFormData({ name: dept.name, code: dept.code });
    setIsEditing(true);
    setCurrentId(dept.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this department?")) {
      try {
        await deleteDepartment(id);
        fetchDepartments();
      } catch (error) {
        alert("Failed to delete department. It may be referenced by existing events.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateDepartment(currentId, formData);
      } else {
        await addDepartment(formData);
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (error) {
      alert("Error saving department: " + error.message);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(226, 22, 41, 0.15)', borderRadius: '16px', color: 'var(--aa-red)' }}>
            <Settings size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Manage Departments</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Configure dynamic departments for the organization</p>
          </div>
        </div>
        <button onClick={handleOpenAdd} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Plus size={20} />
          Add Department
        </button>
      </div>

      <div className="glass-card" style={{ padding: '0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Department Name</th>
                <th style={{ padding: '1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Abbreviation Code</th>
                <th style={{ padding: '1.25rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading departments...</td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No departments found. Please ensure the 'departments' table has RLS policies allowing SELECT, or disable RLS.
                  </td>
                </tr>
              ) : (
                departments.map(dept => (
                  <tr key={dept.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1.25rem' }}>
                      <div style={{ fontWeight: 500 }}>{dept.name}</div>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      <span className="badge badge-blue">{dept.code}</span>
                    </td>
                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handleOpenEdit(dept)}
                          className="btn btn-outline" 
                          style={{ padding: '0.5rem', border: 'none' }}
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(dept.id)}
                          className="btn btn-outline" 
                          style={{ padding: '0.5rem', color: '#F87171', border: 'none' }}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{isEditing ? 'Edit Department' : 'Add New Department'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Department Name</label>
                <input 
                  required 
                  type="text" 
                  name="name" 
                  className="form-control" 
                  value={formData.name} 
                  onChange={handleChange} 
                  placeholder="e.g. Human Resources" 
                />
              </div>

              <div className="form-group">
                <label>Abbreviation Code (2-4 letters)</label>
                <input 
                  required 
                  type="text" 
                  name="code" 
                  className="form-control" 
                  value={formData.code} 
                  onChange={handleChange} 
                  placeholder="e.g. HR" 
                  maxLength={10}
                />
                <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                  Used to generate Event IDs (e.g. IAA/HR/MTG/2026/00001)
                </small>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <Save size={20} />
                  {isEditing ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDepartments;
