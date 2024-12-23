import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from './common/Header';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../config/firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import './ProfilePage.css';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dreamCount, setDreamCount] = useState<number>(0);
  
  useEffect(() => {
    const fetchDreamCount = async () => {
      if (!user) return;
      
      try {
        const dreamsRef = collection(db, 'users', user.uid, 'dreams');
        const snapshot = await getDocs(dreamsRef);
        setDreamCount(snapshot.size);
      } catch (error) {
        console.error('Error fetching dreams:', error);
      }
    };

    fetchDreamCount();
  }, [user]);

  const handleCancelAccount = () => {
    // Implement account deletion logic here
    console.log('Cancel account clicked');
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      navigate('/login');  // Redirect to home page after signing out
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="profile-container">
      <Header 
        hasExistingDreams={true}
        onLibraryClick={() => navigate('/library')}
        onProfileClick={() => navigate('/profile')}
      />

      <div className="profile-content">
        <h1 className="profile-greeting">
            hi, {(user?.displayName || 'dreamer').toLowerCase()}
        </h1>

        <div className="profile-info">
          <div className="info-item">
            <span className="info-label">account creation date:</span>
            <span className="info-value">
              {user?.metadata.creationTime ? 
                new Date(user.metadata.creationTime).toLocaleDateString() : 
                'loading...'}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">dreams logged:</span>
            <span className="info-value">{dreamCount}</span>
          </div>
        </div>

        <button 
          className="sign-out-button"
          onClick={handleSignOut}
        >
          sign out
        </button>

        <button 
          className="cancel-account-button"
          onClick={handleCancelAccount}
        >
          cancel account
        </button>
      </div>
    </div>
  );
}; 