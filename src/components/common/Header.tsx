import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../img/logo.png';
import './Header.css';  


interface HeaderProps {
  hasExistingDreams?: boolean;
  onLibraryClick?: () => void;
  onProfileClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasExistingDreams = false,
  onLibraryClick,
  onProfileClick,
}) => {
  const navigate = useNavigate();
  
  console.log('Header rendered, hasExistingDreams:', hasExistingDreams);

  return (
    <div className="app-header">
      <div className="logo-container">
        <img 
          src={logo} 
          alt="Dream Factory" 
          className="logo"
          onClick={() => navigate('/')}
        />
      </div>
      <div className="header-icons">
        {hasExistingDreams && console.log('Library icon should show')}
        {hasExistingDreams && (
          <img 
            src="/library-icon.png"
            alt="Library" 
            className="library-icon"
            onClick={onLibraryClick}
          />
        )}
        <img 
          src="/profile-icon.png"
          alt="Profile" 
          className="profile-icon"
          onClick={onProfileClick}
        />
      </div>
    </div>
  );
}; 