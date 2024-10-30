import React, { useState } from 'react';
import { AuthPrompt } from '../auth/AuthPrompt';

interface DreamLibraryProps {
  dreamTitle: string;
  dreamImage: string;
  date: string;
}

export const DreamLibrary: React.FC<DreamLibraryProps> = ({ 
  dreamTitle, 
  dreamImage, 
  date 
}) => {
  const [showAuthPrompt, setShowAuthPrompt] = useState(true);

  return (
    <div className="dream-library">
      <div className="app-header">
        <img src={logo} alt="Dream Factory" className="logo" />
        <div className="header-icons">
          <button aria-label="stats">📊</button>
          <button aria-label="profile">👤</button>
        </div>
      </div>

      <h2 className="library-title">dream library</h2>
      
      {showAuthPrompt && (
        <AuthPrompt onClose={() => setShowAuthPrompt(false)} />
      )}
      
      <div className="dream-grid">
        <div className="dream-card">
          <img src={dreamImage} alt={dreamTitle} className="dream-image" />
          <div className="dream-info">
            <div className="dream-title">{dreamTitle}</div>
            <div className="dream-date">{date}</div>
          </div>
        </div>
      </div>
    </div>
  );
}; 