import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../img/logo.png';
import { DreamCard } from './library/DreamCard';
import { Header } from './common/Header';
import './LibraryPage.css'; 

export const LibraryPage = () => {
const navigate = useNavigate();
  const [dreams, setDreams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchDreams();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchDreams = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const dreamsRef = collection(db, 'users', user.uid, 'dreams');
      const dreamSnapshot = await getDocs(dreamsRef);
      
      const dreams = dreamSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Dream data check:', {
          id: doc.id,
          imageUrl: data.imageUrl,
          allFields: Object.keys(data)
        });
        
        return {
          id: doc.id,
          ...data
        };
      });

      dreams.sort((a, b) => b.createdAt - a.createdAt);
      console.log('Dreams before render:', dreams);
      setDreams(dreams);
    } catch (error) {
      console.error('Error fetching dreams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    
    <div className="dream-studio-container library-page">
        <Header 
        hasExistingDreams={true}
        onLibraryClick={() => navigate('/library')}
        onProfileClick={() => navigate('/profile')}  // Make sure this is here
      />

      <h1 className="library-title">dream library</h1>

      <div className="dream-cards-container">
        {isLoading ? (
          <div className="loading-message">loading dreams...</div>
        ) : dreams.length > 0 ? (
          dreams.map((dream) => (
            <DreamCard
              key={dream.id}
              id={dream.id}
              title={dream.title}
              imageUrl={dream.imageUrl}
              date={dream.date}
              onClick={() => {
                navigate(`/dream/${dream.id}`)
                console.log('Dream card clicked:', dream.id); // Debug log
              }}
            />
          ))
        ) : (
          <div className="no-dreams-message">
            No dreams saved yet. <Link to="/dreams">Record your first dream</Link> to see it here!
          </div>
        )}
      </div>
    </div>
  );
}; 