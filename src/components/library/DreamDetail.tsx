import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../common/Header'; 
import './DreamDetail.css';  
import placeholderImage from '/placeholder.jpg'; // Add image import


// interface DreamDetailProps {
//   dream: {
//     id: string;
//     title: string;
//     date: string;
//     imageUrl?: string;
//     transcript: string;
//     analysis: string;
//   };
//   onBack: () => void;
// }

export const DreamDetail: React.FC = () => {
    const { dreamId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [dream, setDream] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
  


    useEffect(() => {
        const fetchDream = async () => {
          try {
            setIsLoading(true);
            if (dreamId && user) {
              const dreamRef = doc(db, 'users', user.uid, 'dreams', dreamId);
              const dreamDoc = await getDoc(dreamRef);
              
              if (dreamDoc.exists()) {
                setDream({
                  id: dreamDoc.id,
                  ...dreamDoc.data()
                });
              }
            }
          } catch (error) {
            console.error('Error fetching dream:', error);
          } finally {
            setIsLoading(false);
          }
        };
    
        fetchDream();
      }, [dreamId, user]);

  if (isLoading) {
    return <div>Loading dream details...</div>;
  }

  if (!dream) {
    return <div>Dream not found</div>;
  }

  return (
    <div className="dream-studio-container dream-detail-screen">
      <Header 
        hasExistingDreams={true}
        onLibraryClick={() => navigate('/library')}
        onProfileClick={() => navigate('/profile')}
      />
      
      <h1 className="dream-library-title">{dream.title.replace(/['"]+/g, '')}</h1>
    
    <div className="dream-detail-content">
      {/* Remove the dream title container since we moved it up */}
      <span className="dream-date">{dream.date}</span>

        <div className="dream-detail-image-container">
          {dream.imageUrl ? (
            <img 
              src={dream.imageUrl} 
              alt="Dream visualization" 
              className="dream-detail-image"
            />
          ) : (
            <div className="placeholder-image">
              <span>✨ Dream Recorded ✨</span>
              console.log
              <img src={placeholderImage} alt="Placeholder" />
              console.log('placeholder image loaded')
            </div>
          )}
          <div className="dream-analysis-overlay">
            <div className="analysis-text">
              {dream.analysis}
            </div>
          </div>
        </div>
      </div>

      <button 
        className="back-to-library"
        onClick={() => navigate('/library')}  // Use navigate instead of onBack
      >
        back to library
      </button>
    </div>
  );
}; 