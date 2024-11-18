import { Link } from 'react-router-dom';
import './LandingPage.css';
import '../styles/shared.css';
import { useNavigate } from 'react-router-dom';  // Add this import at the top
import { useEffect } from 'react';

export const LandingPage = () => {
    const navigate = useNavigate(); 
    useEffect(() => {
        // Check for authentication token in localStorage
        const token = localStorage.getItem('authToken');
        // Or if you're using session storage:
        // const token = sessionStorage.getItem('authToken');
        
        if (token) {
            // Redirect to main app page or dashboard
            navigate('/dashboard');  // or whatever your main route is
        }
    }, [navigate]);
  return (
    <div className="auth-container page-background">
      <div className="landing-content">
        <div className="logo-container">
        <img 
            src="/Logo-large.png" 
            alt="dreamfactory logo" 
            className="logo-image"
          />
        </div>
        
        <h1 className="landing-tagline">let's catch some dreams.</h1>
        
        <div className="auth-buttons">
          <Link to="/login" className="auth-button login-button">
            login
          </Link>
          {/* <Link to="/signup" className="auth-button signup-button">
            sign up
          </Link> */}
        </div>
      </div>
    </div>
  );
}; 