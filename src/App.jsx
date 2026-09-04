import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  CalendarRange, 
  LogOut, 
  Menu, 
  X, 
  PlusCircle, 
  Calendar, 
  BarChart3, 
  Users, 
  Building2, 
  Key, 
  UserCheck 
} from 'lucide-react';
import { getCurrentUser, logoutUser } from './db';
import CreateEvent from './pages/CreateEvent';
import EventList from './pages/EventList';
import EventDashboard from './pages/EventDashboard';
import QRDisplay from './pages/QRDisplay';
import AttendanceForm from './pages/AttendanceForm';
import UserManagement from './pages/UserManagement';
import ManageDepartments from './pages/ManageDepartments';
import ChangePassword from './pages/ChangePassword';
import TrainingAnalytics from './pages/TrainingAnalytics';
import Login from './pages/Login';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkUser = async () => {
      const u = await getCurrentUser();
      setUser(u);
      setLoading(false);
    };
    checkUser();
  }, []);

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.some(r => user.multi_roles?.some(ur => ur.toLowerCase() === r.toLowerCase()))) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppNavigation() {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUser = async () => {
      const u = await getCurrentUser();
      setUser(u);
    };
    fetchUser();
    // Close mobile drawer on route change
    setMobileMenuOpen(false);
  }, [location]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logoutUser();
    setUser(null);
    navigate('/login');
  };

  const isAdminOrSysAdmin = user?.multi_roles?.some(r => 
    r.toLowerCase() === 'admin' || r.toLowerCase() === 'system administrator'
  );
  const isSysAdmin = user?.multi_roles?.some(r => 
    r.toLowerCase() === 'system administrator'
  );
  const canViewAnalytics = user?.multi_roles?.some(r => 
    ['admin', 'system administrator', 'instructor'].includes(r.toLowerCase())
  );

  return (
    <>
      <header className="navbar">
        <Link to="/" className="navbar-brand" onClick={() => setMobileMenuOpen(false)}>
          <img src="/icon.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span className="title-gradient">AttendSync Flow</span>
        </Link>

        {user && (
          <>
            {/* Desktop Navigation */}
            <div className="nav-desktop">
              {isAdminOrSysAdmin && (
                <Link to="/" className="btn btn-primary" style={{ padding: '0.55rem 1.1rem' }}>
                  <PlusCircle size={16} /> Create Event
                </Link>
              )}
              <Link to="/events" className={`btn ${location.pathname === '/events' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '0.55rem 1.1rem' }}>
                All Events
              </Link>
              {canViewAnalytics && (
                <Link to="/analytics" className={`btn ${location.pathname === '/analytics' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '0.55rem 1.1rem' }}>
                  Training Analytics
                </Link>
              )}
              {isAdminOrSysAdmin && (
                <Link to="/users" className={`btn ${location.pathname === '/users' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '0.55rem 1.1rem' }}>
                  Manage Users
                </Link>
              )}
              {isSysAdmin && (
                <Link to="/departments" className={`btn ${location.pathname === '/departments' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '0.55rem 1.1rem' }}>
                  Departments
                </Link>
              )}
              <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem', marginLeft: '0.25rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--aa-white)', lineHeight: 1.2 }}>{user.username}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                  {user.multi_roles?.join(' • ')}
                </div>
              </div>
              <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.55rem 0.85rem' }} title="Log out">
                <LogOut size={17} />
              </button>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button 
              className="nav-mobile-toggle" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </>
        )}
      </header>

      {/* Mobile Menu Drawer Overlay */}
      {user && mobileMenuOpen && (
        <>
          <div 
            className="mobile-menu-overlay" 
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="mobile-menu-drawer">
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <img src="/icon.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <span style={{ fontWeight: 800, fontSize: '1.15rem' }} className="title-gradient">AttendSync</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', padding: '0.4rem', cursor: 'pointer', display: 'flex' }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Profile Tile in Mobile Menu */}
            <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '14px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(226, 22, 41, 0.15)', color: 'var(--aa-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  {user.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--aa-white)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user.username}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {user.multi_roles?.join(' • ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Navigation Links */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {isAdminOrSysAdmin && (
                <Link 
                  to="/" 
                  className={`mobile-nav-link mobile-nav-link-primary ${location.pathname === '/' ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <PlusCircle size={18} />
                  <span>Create New Event</span>
                </Link>
              )}

              <Link 
                to="/events" 
                className={`mobile-nav-link ${location.pathname === '/events' ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Calendar size={18} />
                <span>All Events</span>
              </Link>

              {canViewAnalytics && (
                <Link 
                  to="/analytics" 
                  className={`mobile-nav-link ${location.pathname === '/analytics' ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <BarChart3 size={18} />
                  <span>Training Analytics</span>
                </Link>
              )}

              {isAdminOrSysAdmin && (
                <Link 
                  to="/users" 
                  className={`mobile-nav-link ${location.pathname === '/users' ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Users size={18} />
                  <span>Manage Users</span>
                </Link>
              )}

              {isSysAdmin && (
                <Link 
                  to="/departments" 
                  className={`mobile-nav-link ${location.pathname === '/departments' ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Building2 size={18} />
                  <span>Manage Departments</span>
                </Link>
              )}

              <Link 
                to="/change-password" 
                className={`mobile-nav-link ${location.pathname === '/change-password' ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Key size={18} />
                <span>Account Settings</span>
              </Link>
            </div>

            {/* Mobile Drawer Footer Logout */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                onClick={handleLogout} 
                className="btn btn-outline" 
                style={{ width: '100%', borderColor: 'rgba(248, 113, 113, 0.3)', color: '#F87171' }}
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="container">
        <AppNavigation />
        
        <main>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute allowedRoles={['Admin', 'System Administrator']}>
                <CreateEvent />
              </ProtectedRoute>
            } />
            <Route path="/change-password" element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute allowedRoles={['Admin', 'System Administrator', 'Instructor']}>
                <TrainingAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['Admin', 'System Administrator']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/departments" element={
              <ProtectedRoute allowedRoles={['System Administrator']}>
                <ManageDepartments />
              </ProtectedRoute>
            } />
            <Route path="/events" element={
              <ProtectedRoute>
                <EventList />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/:eventId" element={
              <ProtectedRoute>
                <EventDashboard />
              </ProtectedRoute>
            } />
            <Route path="/qr/:eventId" element={
              <ProtectedRoute>
                <QRDisplay />
              </ProtectedRoute>
            } />
            <Route path="/attend/:eventId" element={<AttendanceForm />} />
            {/* Fallback route to prevent blank pages */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
