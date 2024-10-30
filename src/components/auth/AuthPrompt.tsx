import React from 'react';
import googleIcon from '../../img/branding_guideline_sample_lt_rd_lg.svg';
import appleIcon from '../../img/apple-account-continue-with~dark@2x.png';

interface AuthPromptProps {
  onClose: () => void;
}

export const AuthPrompt: React.FC<AuthPromptProps> = ({ onClose }) => {
  return (
    <div className="auth-overlay">
      <div className="auth-prompt">
        <h3>Save your dreams</h3>
        <p>Sign in to save your dream library</p>
        
        <button className="auth-button google">
          <img 
            src={googleIcon} 
            alt="Continue with Google"
            className="google-icon"
          />
        </button>
        
        <button className="auth-button apple">
          <img 
            src={appleIcon} 
            alt="Continue with Apple"
            className="apple-icon"
          />
        </button>
      </div>
    </div>
  );
}; 