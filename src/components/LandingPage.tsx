import { Link } from 'react-router-dom';
import './LandingPage.css';

import '../styles/shared.css';

export const LandingPage = () => {
  return (
    <div className="auth-container page-background">
      <div className="landing-content">
        <div className="logo-container">
          <span className="logo-text">
            <span className="logo-dream">dream</span>
            <span className="logo-factory">factory</span>
          </span>
        </div>
        
        <h1 className="landing-tagline">let's catch some dreams.</h1>
        
        <div className="auth-buttons">
          <Link to="/login" className="auth-button login-button">
            login
          </Link>
          <Link to="/signup" className="auth-button signup-button">
            sign up
          </Link>
        </div>
      </div>
    </div>
  );
}; 