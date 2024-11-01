import React, { useEffect, useState, useRef } from 'react'
import './dream-capture-studio.css'
import logo from './img/logo.png';
import { DreamLibrary } from './components/library/DreamLibrary';
import { useAuth } from './context/AuthContext';
import { Link } from 'react-router-dom';
import { db } from './config/firebase';
import { 
  collection, 
  getDocs,
  doc,
  setDoc,
  getFirestore 
} from 'firebase/firestore';

if (process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0]?.includes('chrome-extension://')) return;
    originalError.apply(console, args);
  };
}

const DreamCaptureStudio: React.FC = () => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Refs for audio visualization
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  const [hasRecorded, setHasRecorded] = useState(false);

  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [isFullTranscript, setIsFullTranscript] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const [autoRecord, setAutoRecord] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);

  const [showLibrary, setShowLibrary] = useState(false);

  // Add new state for title generation
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [dreamTitle, setDreamTitle] = useState<string | null>(null);

  // Add new state for image
  const [dreamImage, setDreamImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Add this state near your other state declarations
  const [isSaving, setIsSaving] = useState(false);

  // First, update the state declaration
  const [currentDreamData, setCurrentDreamData] = useState<{
    title: string;
    transcript: string;
    analysis: string;
    date: string;
    timestamp: string;
  } | null>(null);

  // Add this with your other state declarations
  const [dreams, setDreams] = useState<any[]>([]);

  interface DreamEntry {
    id: number;
    title: string;
    date: string;
    imageUrl: string;
    transcript: string;
    analysis: string;
  }

  const getTruncatedTranscript = (text: string) => {
    if (!text) return '';
    const lines = text.split('\n');
    if (lines.length <= 5) return text;
    return lines.slice(0, 5).join('\n') + '...';
  };

  const cleanupAudioNodes = () => {
    console.log('Cleaning up audio nodes');
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const setupAudioContext = (stream: MediaStream) => {
    cleanupAudioNodes();
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);
  };

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = '#1E3D59';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = '#FFC2A6';
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();
  };

  const drawPlaybackWaveform = () => {
    if (!audioRef.current) return;

    try {
      // Create new audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Create new analyzer if needed
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
      }

      // Only create new source node if one doesn't exist
      if (!sourceNodeRef.current && audioRef.current) {
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
        sourceNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }

      // Start visualization
      drawWaveform();
    } catch (err) {
      console.error('Error setting up audio visualization:', err);
    }
  };

  // Add this helper function to detect browser and supported formats
  const getRecordingOptions = () => {
    const types = [
      'audio/webm;codecs=opus',  // Chrome, Firefox
      'audio/mp4',               // Safari
      'audio/ogg;codecs=opus',   // Firefox
      'audio/webm'               // Fallback
    ];

    // Find the first supported type
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Using recording type:', type);
        return {
          mimeType: type,
          audioBitsPerSecond: 128000
        };
      }
    }

    // If no types are supported, return undefined and let browser use default
    console.log('No specified types supported, using browser default');
    return undefined;
  };

  // Update the recorder creation
  const setupRecorder = (stream: MediaStream) => {
    try {
      const options = getRecordingOptions();
      const recorder = options 
        ? new MediaRecorder(stream, options)
        : new MediaRecorder(stream);

      recorder.onstart = () => {
        setIsRecording(true);
        drawWaveform(); // Start waveform visualization
      };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped');
        setIsRecording(false);
        setHasRecorded(true);

        // Create blob using the same type as the recording
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        });
        console.log('Created blob:', {
          size: blob.size,
          type: blob.type
        });

        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }

        const url = URL.createObjectURL(blob);
        
        // Set up audio element
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
        }

        setAudioUrl(url);
        setAudioBlob(blob);
      };

      return recorder;
    } catch (err) {
      console.error('Recorder setup error:', err);
      return null;
    }
  };

  // Update handleRecordToggle to use the new setup
  const handleRecordToggle = () => {
    if (hasRecorded && !isRecording) {
      handlePlayPause();
      return;
    }

    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      stopAllMediaTracks();
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          mediaStreamRef.current = stream;
          setupAudioContext(stream);
          
          const recorder = setupRecorder(stream);
          if (recorder) {
            setMediaRecorder(recorder);
            recorder.start(100); // Small chunks for better compatibility
            setIsRecording(true);
            chunksRef.current = [];
          }
        })
        .catch(err => console.error('Media stream error:', err));
    }
  };

  const handleSaveDream = async () => {
    if (!audioBlob) {
      console.error('No audio recording found');
      return;
    }

    console.log('Starting transcription process');
    setIsTranscribing(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onload = async () => {
        try {
          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: (() => {
              const formData = new FormData();
              const audioFile = new Blob([audioBlob], { type: 'audio/mp3' });
              formData.append('file', audioFile, 'recording.mp3');
              formData.append('model', 'whisper-1');
              formData.append('language', 'en');
              return formData;
            })()
          });

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
          }

          const data = await response.json();
          console.log('Received transcript:', data.text);
          
          // Update states in correct order
          setTranscript(data.text);
          setIsTranscribing(false);
          setShowTranscript(true); // Move this last
          console.log('States updated, should show transcript screen');

          // After successful transcription, make sure we preserve the audio URL
          if (audioRef.current && audioUrl) {
            console.log('Preserving audio for transcript screen');
            audioRef.current.src = audioUrl;
            audioRef.current.load();
          }
        } catch (error) {
          console.error('Error in transcription:', error);
          setIsTranscribing(false);
        }
      };
    } catch (error) {
      console.error('Transcription error:', error);
      setIsTranscribing(false);
    }
  };

  const analyzeDream = async (transcript: string) => {
    console.log('Starting dream analysis...');
    console.log('Transcript:', transcript);
    console.log('API Key available:', !!OPENAI_API_KEY);

    try {
      setIsAnalyzing(true);
      console.log('Making API calls to OpenAI...');
      
      // Make both API calls in parallel
      const [titleResponse, analysisResponse] = await Promise.all([
        // Title generation
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "Generate a concise 2-3 word title for this dream. Use simple, descriptive words. Avoid emotional or flowery language."
              },
              {
                role: "user",
                content: transcript
              }
            ]
          })
        }),
        
        // Analysis generation
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `You are a neutral dream analyzer...`
              },
              {
                role: "user",
                content: `Analyze this dream: ${transcript}`
              }
            ]
          })
        })
      ]);

      console.log('Responses received from OpenAI');
      
      // Check if responses are ok
      if (!titleResponse.ok || !analysisResponse.ok) {
        throw new Error('API response not ok');
      }

      const [titleData, analysisData] = await Promise.all([
        titleResponse.json(),
        analysisResponse.json()
      ]);

      console.log('Title data:', titleData);
      console.log('Analysis data:', analysisData);

      // Add null checks and error handling
      if (!titleData?.choices?.[0]?.message?.content || !analysisData?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from OpenAI');
      }

      const title = titleData.choices[0].message.content;
      const analysisText = analysisData.choices[0].message.content;

      console.log('Title generated:', title);
      console.log('Analysis generated:', analysisText);

      // Update state with both title and analysis
      setDreamTitle(title);
      setAnalysis(analysisText);
      setShowTranscript(false);
      setShowAnalysis(true);
      
    } catch (error) {
      console.error('Analysis/Title generation error:', error);
      setAnalysis('Unable to analyze dream at this time. Please try again later.');
      setDreamTitle('Untitled Dream');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Cleanup on unmount or component updates
  useEffect(() => {
    return () => {
      stopAllMediaTracks();
      cleanupAudioNodes();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  // Add current date formatting
  const getCurrentDate = () => {a
    const date = new Date();
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
  };

  // Update the library button handler
  const handleSaveToLibrary = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      console.log('Starting save to library process');

      // 1. Get user's locale and timezone info
      const userLocale = navigator.language || 'en-US';
      const userDate = new Date();
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      console.log('User locale:', userLocale);
      console.log('User timezone:', userTimezone);
      console.log('Local date/time:', userDate.toString());
      
      // 2. Format the date (MM-DD-YY)
      const formattedDate = userDate.toLocaleDateString(userLocale, {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
        timeZone: userTimezone
      }).replace(/[/\.]/g, '-');  // Replace slashes or dots with hyphens
      
      console.log('Formatted local date:', formattedDate);

      // 3. Create the dream data object with all required fields
      const dreamData = {
        title: dreamTitle || 'Untitled Dream',
        transcript: transcript || '',
        analysis: analysis || '',
        dreamImage: dreamImage || null,
        date: formattedDate,
        timestamp: userDate.toISOString(),
        userId: user.uid,  // This is important for the security rules
        createdAt: userDate.getTime()      // Milliseconds since epoch for easy sorting
      };

      setCurrentDreamData(dreamData);

      console.log('Dream data object created:', dreamData);

      // Generate image before saving
      console.log('Starting image generation');
      await generateDreamImage();

      // Dreams are saved to Firestore under the user's ID
      const dreamRef = doc(collection(db, 'users', user.uid, 'dreams'));
      await setDoc(dreamRef, dreamData);

      console.log('Dream saved successfully with ID:', dreamRef.id);

      // Update UI states
      setShowAnalysis(false);
      setShowLibrary(true);
      setHasExistingDreams(true);

      // Continue with the rest of the save process...
    } catch (error) {
      console.error('Error saving dream:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Add image generation function
  const generateDreamImage = async () => {
    setIsGeneratingImage(true);
    
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `Create a hyper-realistic photograph interpreting this dream: ${analysis}. Style: photorealistic, cinematic, high detail, dramatic lighting.`,
          n: 1,
          size: "1024x1024"
        })
      });

      const data = await response.json();
      setDreamImage(data.data[0].url);
      console.log('Dream image generated:', data.data[0].url);
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGeneratingImage(false);
      //console.log('Image generation failed');
    }
  };

  const handlePlayPause = async () => {
    console.log('Play/Pause clicked');
    console.log('Audio ref exists:', !!audioRef.current);
    console.log('Audio URL exists:', !!audioUrl);
    console.log('Audio ref src:', audioRef.current?.src);
    console.log('Is Playing:', isPlaying);

    if (!audioRef.current || !audioUrl) {
      console.error('Missing audio requirements:', {
        audioRef: !!audioRef.current,
        audioUrl: !!audioUrl
      });
      return;
    }

    try {
      if (isPlaying) {
        await audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.src = audioUrl;
        await audioRef.current.load();
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Playback error details:', err);
    }
  };

  // Add this function near your other utility functions
  const stopAllMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      mediaStreamRef.current = null;
    }
  };

  // Add this with your other functions
  const handleAnalyze = () => {
    console.log('Analyzing dream transcript:', transcript);
    // Add your analysis logic here
    // For now, we'll just log the transcript
  };

  // Add a useEffect to monitor audio state changes
  useEffect(() => {
    if (showTranscript && audioRef.current && audioUrl) {
      console.log('Setting up audio for transcript screen');
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [showTranscript, audioUrl]);

  // Add this useEffect to debug audio element mounting
  useEffect(() => {
    console.log('Audio element mounted:', !!audioRef.current);
  }, [audioRef.current]);

  // Add new state for detail view
  const [selectedDream, setSelectedDream] = useState<DreamEntry | null>(null);
  const [showDreamDetail, setShowDreamDetail] = useState(false);

  // Add handler for dream card selection
  const handleDreamSelect = (dream: DreamEntry) => {
    setSelectedDream(dream);
    setShowDreamDetail(true);
  };

  const { user } = useAuth();

  const [hasExistingDreams, setHasExistingDreams] = useState(false);

  const checkForExistingDreams = async (userId: string) => {
    try {
      console.log('Checking dreams for user:', userId);
      console.log('Auth state:', user);  // Add this to check auth state
      
      const dreamsRef = collection(db, 'users', userId, 'dreams');
      console.log('Dreams reference created');
      
      const dreamSnapshot = await getDocs(dreamsRef);
      console.log('Got dreams snapshot:', dreamSnapshot);
      
      setHasExistingDreams(!dreamSnapshot.empty);
      console.log('User has dreams:', !dreamSnapshot.empty);
    } catch (error) {
      console.error('Error checking for dreams:', error);
      // Log the full error object
      console.log('Full error:', JSON.stringify(error, null, 2));
    }
  };

  useEffect(() => {
    if (user) {
      console.log('User authenticated:', user.uid);
      checkForExistingDreams(user.uid);
    } else {
      console.log('No user authenticated');
    }
  }, [user]);
  const fetchDreams = async () => {
    if (!user) return;
    
    try {
      const dreamsRef = collection(db, 'users', user.uid, 'dreams');
      const dreamSnapshot = await getDocs(dreamsRef);
      const dreams = dreamSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort dreams by timestamp, newest first
      dreams.sort((a, b) => b.createdAt - a.createdAt);
      
      // Set the dreams in state to display them
      setDreams(dreams);
    } catch (error) {
      console.error('Error fetching dreams:', error);
    }
  };

  // Add this useEffect to fetch dreams when library is shown
  useEffect(() => {
    if (showLibrary && user) {
      console.log('Fetching dreams for library view');
      fetchDreams();
    }
  }, [showLibrary, user]);

  return (
    <div className="dream-studio-container">
      <audio 
        ref={audioRef} 
        src={audioUrl || ''} 
        preload="auto"
        onError={(e) => console.error('Audio element error:', e)}
      />

      {showDreamDetail ? (
        <div className="dream-detail-screen">
          <div className="app-header">
            <img src={logo} alt="Dream Factory" className="logo" />
            <div className="header-icons">
             
            </div>
          </div>

          <h1 className="dream-library-title">dream library</h1>
          
          <div className="dream-detail-content">
            <div className="dream-title-container">
              <h2 className="dream-title">"{selectedDream?.title}"</h2>
              <span className="dream-date">{selectedDream?.date}</span>
            </div>

            <div className="dream-detail-image-container">
              <img 
                src={selectedDream?.imageUrl} 
                alt="Dream visualization" 
                className="dream-detail-image"
              />
              <div className="dream-analysis-overlay">
                <div className="analysis-label">Analysis generated:</div>
                <div className="analysis-text">
                  {selectedDream?.analysis}
                </div>
              </div>
            </div>
          </div>

          <button 
            className="back-to-library"
            onClick={() => {
              setShowDreamDetail(false);
              setSelectedDream(null);
            }}
          >
            back to library
          </button>
        </div>
      ) : showLibrary ? (
        <div className="library-screen">
          <div className="app-header">
            <img src={logo} alt="Dream Factory" className="logo" />
            <div className="header-icons">
              <Link to="/library" className="library-link">
                library
              </Link>
            </div>
          </div>

          <h1 className="library-title">dream library</h1>

          <div className="dream-cards-container">
            {currentDreamData && (
              <div 
                className="dream-card"
                onClick={() => handleDreamSelect({
                  id: 1, // Add an ID if needed
                  title: currentDreamData.title,
                  date: currentDreamData.date,
                  imageUrl: dreamImage || '', // Add the dreamImage state here
                  transcript: currentDreamData.transcript,
                  analysis: currentDreamData.analysis
                })}
              >
                <div className="dream-card-image">
                  {dreamImage ? (
                    <img src={dreamImage} alt="Dream visualization" className="dream-image" />
                  ) : (
                    <div className="placeholder-x">
                      <div className="x-line1"></div>
                      <div className="x-line2"></div>
                    </div>
                  )}
                </div>
                <div className="dream-card-info">
                  <h2 className="dream-card-title">{currentDreamData.title}</h2>
                  <span className="dream-card-date">{currentDreamData.date}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : showAnalysis ? (
        <div className="analysis-screen">
          <div className="app-header">
            <img src={logo} alt="Dream Factory" className="logo" />
            <div className="header-icons">
              
            </div>
          </div>

          <h1 className="studio-title">dream analysis</h1>
          
          <div className="analysis-content">
            <div className={`analysis-container ${isExpanded ? 'expanded' : ''}`}>
              <div className={`analysis-text-container ${isExpanded ? 'expanded' : ''}`}>
                <h2 className="dream-title">{dreamTitle}</h2>
                <p className="analysis-text">{analysis}</p>
              </div>
              <span 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="more-text"
              >
                {isExpanded ? 'less' : 'more'}
              </span>
            </div>

            <button 
              onClick={handleSaveToLibrary}
              className="library-button"
              disabled={isSaving}
            >
              {isSaving ? 'saving...' : 'save to library'}
            </button>
          </div>
        </div>
      ) : showTranscript ? (
        // Transcript screen
        <div className="transcript-screen">
          <div className="app-header">
            <img src={logo} alt="Dream Factory" className="logo" />
            <div className="header-icons">
              
            </div>
          </div>

          <h1 className="studio-title studio-title-transcript">dream capture studio</h1>
          
          <div className="transcript-content">
            <div className="transcript-label">transcript</div>
            
            <div className={`transcript-container ${isExpanded ? 'expanded' : ''}`}>
              <div className={`transcript-text-container ${isExpanded ? 'expanded' : ''}`}>
                <p className="transcript-text">{transcript}</p>
              </div>
              <span 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="more-text"
              >
                {isExpanded ? 'less' : 'more'}
              </span>
            </div>

            <div className="playback-controls">
              <button 
                onClick={handlePlayPause}
                className="play-button-large"
                disabled={!audioRef.current || !audioUrl}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>
            </div>

            <button 
              onClick={() => analyzeDream(transcript || '')}
              className="analyze-button"
              disabled={isAnalyzing || !transcript}
            >
              {isAnalyzing ? 'analyzing...' : 'analyze dream'}
            </button>
          </div>
        </div>
      ) : (
        // Recording screen
        <>
          <div className="app-header">
            <img src={logo} alt="Dream Factory" className="logo" />
            <div className="header-icons">
              {(hasExistingDreams || showLibrary) && (
                <Link to="/library" className="library-link">
                  library
                </Link>
              )}
            </div>
          </div>

          <h1 className="studio-title">dream capture studio</h1>

          {/* Waveform */}
          <div className={`waveform ${hasRecorded || isRecording ? 'recording' : ''}`}>
            <canvas 
              ref={canvasRef} 
              className="waveform-canvas"
            />
          </div>

          {/* Record Button and Status */}
          <div className={`controls-container ${hasRecorded || isRecording ? 'recording' : ''}`}>
            <button 
              onClick={handleRecordToggle}
              className="record-button"
            >
              {isRecording || isPlaying ? (
                <span className="pause-icon">❚❚</span>
              ) : !hasRecorded ? (
                <span className="record-text">REC</span>
              ) : (
                <span className="play-icon">▶</span>
              )}
            </button>
            <div className="status-text">
              {isRecording ? 'Recording...' : 
               isPlaying ? 'Playing...' :
               hasRecorded ? 'tap to play' : 
               'tap to record'}
            </div>
          </div>

          {audioUrl && !isRecording && (
            <button 
              onClick={handlePlayPause}
              //className={`playback-button ${isPlaying ? 'playing' : ''}`}
            >
              {/* {isPlaying ? 'Pause' : 'Play'} */}
            </button>
          )}

          {hasRecorded && !isRecording && (
            <button 
              onClick={handleSaveDream}
              className="save-button"
              disabled={isTranscribing}
            >
              {isTranscribing ? 'transcribing...' : 'save dream'}
            </button>
          )}
        </>
      )}

      {/* <div className="auth-container">
        {!user && (
          <Link to="/signup" className="auth-button signup-button">
            Sign Up
          </Link>
        )}
      </div> */}
    </div>
  );
};

export default DreamCaptureStudio;