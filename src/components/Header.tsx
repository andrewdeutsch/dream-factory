import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Header = () => {
  const { user } = useAuth();
  // You'll need to add a way to check if user has dreams
  // This could be a new context or a prop passed from parent
  const hasDreams = false; // We'll implement this logic later

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-dream">dream</span>
          <span className="logo-factory">factory</span>
        </Link>
        
        <nav className="nav-links">
          {hasDreams && (
            <Link to="/library" className="nav-link">
              Library
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}; 