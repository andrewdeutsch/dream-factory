import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';
import '../../styles/shared.css';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(username, password);
    } catch (err) {
      setError('Failed to sign in');
    }
  };

  return (
    <div className="auth-container page-background">
      <div className="auth-content">
        {/* Logo */}
        <div className="logo-container">
          <span className="logo-text">
            <span className="logo-dream">dream</span>
            <span className="logo-factory">factory</span>
          </span>
        </div>

        {/* Sign In Form */}
        <div className="auth-form-container">
          <h2>sign in to your account</h2>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>

            <div className="forgot-password">
              <Link to="/forgot-password">Forgot your password?</Link>
            </div>

            <button type="submit" className="auth-submit">
              Sign In
            </button>
          </form>

          <div className="divider">
            <span>or</span>
          </div>

          <img 
            src="branding_guideline_sample_lt_rd_lg.svg"
            alt="Sign in with Google"
            className="google-sign-in-button"
            onClick={signInWithGoogle}
          />
        </div>
      </div>
    </div>
  );
}; 