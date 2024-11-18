import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect } from 'react';
import './Auth.css';
import '../../styles/shared.css';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate(); 


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
            <img 
            src="/Logo-large.png" 
            alt="Dream Factory" 
            className="logo-image"
            />
        </div>

        {/* Sign In Form */}
        <div className="auth-form-container">
        <div className='headline-text'>catch,save and make sense of your dreams</div>
          <div className='instructions-text'>sign in to your account</div>

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