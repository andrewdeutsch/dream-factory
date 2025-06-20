import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../common/Header'; 
import './DreamDetail.css';  
import placeholderImage from '/placeholder.jpg'; // Add image import
// import audioIconOn from 'public/audio-icon-on.png';
// import audioIconOff from '/public/audio-icon-off.png';



export const DreamDetail: React.FC = () => {
    const { dreamId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [dream, setDream] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeView, setActiveView] = useState<'analysis' | 'transcript'>('analysis');
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAnalysisOverflowing, setIsAnalysisOverflowing] = useState(false);
    const analysisRef = useRef<HTMLDivElement | null>(null);  
    const [audioBlob, setAudioBlob] = useState<string | null>(null);
    const [isAudioLoading, setIsAudioLoading] = useState(false);  


    const toggleAudio = async () => {
      if (!audioRef.current || isAudioLoading) return;
    
      try {
        setIsAudioLoading(true);
        console.log('Current audio src:', audioRef.current.src);
        console.log('Audio ready state:', audioRef.current.readyState);
        
        if (isPlaying) {
          await audioRef.current.pause();
          setIsPlaying(false);
        } else {
          // Load the audio if it hasn't been loaded
          if (audioRef.current.readyState === 0) {
            await audioRef.current.load();
          }
          await audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      } finally {
        setIsAudioLoading(false);
      }
    };
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const handleDeleteDream = async () => {
      try {
        if (!user || !dreamId) return;
        
        const dreamRef = doc(db, 'users', user.uid, 'dreams', dreamId);
        await deleteDoc(dreamRef);
        
        // Navigate back to library after successful deletion
        navigate('/library');
      } catch (error) {
        console.error('Error deleting dream:', error);
      }
    };


    useEffect(() => {
        const fetchDream = async () => {
          try {
            setIsLoading(true);
            if (dreamId && user) {
              const dreamRef = doc(db, 'users', user.uid, 'dreams', dreamId);
              const dreamDoc = await getDoc(dreamRef);
              
              if (dreamDoc.exists()) {
                const dreamData = {
                  id: dreamDoc.id,
                  ...dreamDoc.data()
                };
                console.log('Fetched dream data:', dreamData); // Debug log
                setDream(dreamData);
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

        // useEffect(() => {
        //   if (dream?.audioUrl) {
        //     console.log('Original audio URL:', dream.audioUrl);
            
        
        //     // Fetch the audio file and create a blob URL
        //     fetch(dream.audioUrl)
        //       .then(response => {
        //         if (!response.ok) {
        //           throw new Error(`HTTP error! status: ${response.status}`);
        //         }
        //         return response.blob();
        //       })
        //       .then(blob => {
        //         const blobUrl = URL.createObjectURL(blob);
        //         console.log('Created blob URL:', blobUrl);
        //         setAudioBlob(blobUrl);
        //       })
        //       .catch(error => {
        //         console.error('Error creating blob URL:', error);
        //       });
        //   }
        
        //   // Cleanup function to revoke blob URL
        //   return () => {
        //     if (audioBlob) {
        //       URL.revokeObjectURL(audioBlob);
        //     }
        //   };
        // }, [dream?.audioUrl]); 

      useEffect(() => {
        const checkOverflow = (element: HTMLDivElement | null) => {
          if (!element) return false;
          const textContainer = element.querySelector('.analysis-text-container');
          if (!textContainer) return false;
          
          const textElement = textContainer.querySelector('.analysis-text');
          if (!textElement) return false;
      
          return textElement.scrollHeight > textContainer.clientHeight;
        };

        console.log('isAnalysisOverflowing:', isAnalysisOverflowing);
      
        setTimeout(() => {
          setIsAnalysisOverflowing(checkOverflow(analysisRef.current));
        }, 100);
      }, [dream?.analysis, isExpanded]);

      console.log('Current view:', activeView);
      //console.log('Dream transcript:', dream?.transcript);
      //console.log('Dream analysis:', dream?.analysis);

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
      <button 
      className="back-button" 
      onClick={() => navigate(-1)}
    >
      ←
    </button>
      <h1 className="dream-library-title">
        {dream.title ? dream.title.replace(/['"]+/g, '') : 'Untitled Dream'}</h1>
    <div className="dream-detail-content">
      {/* Remove the dream title container since we moved it up */}
      <span className="dream-date">{dream.date}</span>

        <div className="dream-detail-image-container">
          {dream.imageUrl ? (
            <img 
            src={dream.imageUrl} 
            alt={dream.title} 
            className="dream-detail-image"
          />
          ) : (
            <div className="placeholder-image">
              <span>✨ Dream Recorded ✨</span>
              console.log
              <img src={placeholderImage} alt="Placeholder" />
              {/* console.log('placeholder image loaded') */}
            </div>
          )}
          {/* Add toggle options */}
          <div className="dream-options">
            <button 
              className={`option-button ${activeView === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveView('analysis')}
            >
              analysis
            </button>
            <button 
              className={`option-button ${activeView === 'transcript' ? 'active' : ''}`}
              onClick={() => setActiveView('transcript')}
            >
              transcript
            </button>
            {/* {dream.audioUrl && (
            <>
              <img 
                src={isPlaying ? "/audio-icon-on.png" : "/audio-icon-off.png"}
                alt="Toggle audio"
                className="audio-icon"
                onClick={toggleAudio}
                style={{ 
                  cursor: isAudioLoading ? 'wait' : 'pointer',
                  opacity: isAudioLoading ? 0.5 : 1 
                }}
              />
              <audio 
                ref={audioRef}
                src={audioBlob || undefined}
                onEnded={() => setIsPlaying(false)}
                onError={(e) => {
                  console.error('Audio error:', e);
                  console.log('Audio URL:', audioBlob);
                  setIsPlaying(false);
                }}
                style={{ display: 'none' }}
              />
            </>
          )} */}
          <button 
            className="option-button"
            onClick={() => setShowDeleteModal(true)}
          >
            delete dream
        </button>
          </div>
        </div>

        
      </div>
      <div className="analysis-container">
        <div className="dream-analysis-text-container ">
          <div className="analysis-text">
            {activeView === 'analysis' 
              ? (dream.analysis || 'No analysis available')
              : (dream.transcript || 'No transcript available')
            }
          </div>
        </div>
      </div>
      {showDeleteModal && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h2>Are you sure you want to delete this dream?</h2>
            <div className="delete-modal-buttons">
              <button 
                className="delete-confirm-button"
                onClick={handleDeleteDream}
              >
                yes
              </button>
              <button 
                className="delete-cancel-button"
                onClick={() => setShowDeleteModal(false)}
              >
                no
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  
)};