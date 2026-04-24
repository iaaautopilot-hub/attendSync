import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CalendarRange, LogOut } from 'lucide-react';
import { getCurrentUser, logoutUser } from './db';
import CreateEvent from './pages/CreateEvent';
import EventList from './pages/EventList';
import EventDashboard from './pages/EventDashboard';
import QRDisplay from './pages/QRDisplay';
import AttendanceForm from './pages/AttendanceForm';
import UserManagement from './pages/UserManagement';
import ChangePassword from './pages/ChangePassword';
import Login from './pages/Login';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const location = useLocation();

  React.useEffect(() => {
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

  if (allowedRoles && !allowedRoles.some(r => r.toLowerCase() === user.role?.toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppNavigation() {
  const [user, setUser] = React.useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const fetchUser = async () => {
      const u = await getCurrentUser();
      setUser(u);
    };
    fetchUser();
  }, [location]);

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    navigate('/login');
  };

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <img src="/icon.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        <span className="title-gradient">AttendSync Flow</span>
      </Link>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link to="/events" className="btn btn-outline" style={{ padding: '0.6rem 1.2rem' }}>
            All Events
          </Link>
          {user.role?.toLowerCase() === 'admin' && (
            <Link to="/users" className="btn btn-outline" style={{ padding: '0.6rem 1.2rem' }}>
              Manage Users
            </Link>
          )}
          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--aa-white)' }}>{user.username}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user.role}</div>
          </div>
          <Link to="/change-password" title="Change Password" style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem', fontSize: '1.2rem', textDecoration: 'none' }}>
            ⚙️
          </Link>
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.6rem 1rem' }}>
            <LogOut size={18} />
          </button>
        </div>
      )}
    </header>
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
              <ProtectedRoute>
                <CreateEvent />
              </ProtectedRoute>
            } />
            <Route path="/change-password" element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <UserManagement />
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
