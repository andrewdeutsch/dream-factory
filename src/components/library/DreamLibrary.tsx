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
    <div className="library-screen">
      <div className="app-header">
        <img src={logo} alt="Dream Factory" className="logo" />
        <div className="header-icons">
          <button className="stats-icon">📊</button>
          <button className="profile-icon">👤</button>
        </div>
      </div>

      <h1 className="library-title">dream library</h1>

      <div className="dream-cards-container">
        <div className="dream-card">
          <div className="dream-card-image">
            <div className="placeholder-x">
              <div className="x-line1"></div>
              <div className="x-line2"></div>
            </div>
          </div>
          <div className="dream-card-info">
            <h2 className="dream-card-title">{dreamTitle}</h2>
            <span className="dream-card-date">{date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 