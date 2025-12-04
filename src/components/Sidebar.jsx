import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  Settings,
  LogOut 
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

const Sidebar = () => {
  const handleLogout = () => {
    signOut(auth);
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/applicants', icon: Users, label: 'Postulantes' },
    { to: '/questions', icon: FileText, label: 'Preguntas' },
    { to: '/answers', icon: FileText, label: 'Respuestas' },
    { to: '/reports', icon: BarChart3, label: 'Reportes' },
    { to: '/settings', icon: Settings, label: 'Configuración' }
  ];

  return (
    <div className="sidebar">
      <div className="mb-8">
        <h1 className="sidebar-title">Admin Panel</h1>
        <p className="sidebar-subtitle">Análisis de Postulantes</p>
      </div>

      <nav>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ position: 'absolute', bottom: '1rem', width: 'calc(100% - 2rem)' }}>
        <button
          onClick={handleLogout}
          className="nav-item"
          style={{ 
            backgroundColor: 'var(--primary-blue)', 
            color: 'white',
            width: '100%'
          }}
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;