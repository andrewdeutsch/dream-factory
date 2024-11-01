import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { signUp, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      console.error('Passwords do not match');
      return;
    }
    try {
      await signUp(email, password);
    } catch (error) {
      console.error('Error signing up:', error);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-content">
        <div className="logo-container">
          <span className="logo-text">
            <span className="logo-dream">dream</span>
            <span className="logo-factory">factory</span>
          </span>
        </div>

        <h2>Create your account</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-button">
            Sign Up
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <button 
          onClick={() => signInWithGoogle()} 
          className="google-button"
        >
          <img 
            src="/branding_guideline_sample_lt_rd_lg.svg"
            alt="Sign up with Google"
          />
          Sign up with Google
        </button>

        <div className="auth-links">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}; 