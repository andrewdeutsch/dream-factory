import React, { useState, useEffect, useRef } from 'react';
import logo from '../img/logo.png';

export const TestDeploy: React.FC = () => {
  const [isClicked, setIsClicked] = useState(false);
  const [showEnvStatus, setShowEnvStatus] = useState(false);
  const [envDetails, setEnvDetails] = useState({
    buildEnv: import.meta.env.MODE,
    baseUrl: import.meta.env.BASE_URL,
    envVars: {
      openai: {
        exists: !!import.meta.env.VITE_OPENAI_API_KEY,
        prefix: import.meta.env.VITE_OPENAI_API_KEY?.substring(0, 3) + '...' || 'not found'
      },
      firebase: {
        apiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: !!import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: !!import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: !!import.meta.env.VITE_FIREBASE_APP_ID
      }
    }
  });
  const [apiStatus, setApiStatus] = useState({
    openai: { tested: false, working: false, error: null as string | null },
    firebase: { tested: false, working: false, error: null as string | null }
  });
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [micStatus, setMicStatus] = useState({
    tested: false,
    available: false,
    error: null as string | null
  });
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingChunks = useRef<BlobPart[]>([]);

  useEffect(() => {
    console.log('Build Environment:', import.meta.env.MODE);
    console.log('Environment Variables Status:', envDetails);
  }, []);

  const testOpenAIConnection = async () => {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        }
      });
      
      if (response.ok) {
        setApiStatus(prev => ({
          ...prev,
          openai: { tested: true, working: true, error: null }
        }));
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setApiStatus(prev => ({
        ...prev,
        openai: { tested: true, working: false, error: String(error) }
      }));
    }
  };

  const testFirebaseConnection = async () => {
    try {
      // Just verify Firebase config exists
      const hasConfig = 
        import.meta.env.VITE_FIREBASE_API_KEY &&
        import.meta.env.VITE_FIREBASE_PROJECT_ID &&
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
      
      setApiStatus(prev => ({
        ...prev,
        firebase: { 
          tested: true, 
          working: hasConfig, 
          error: hasConfig ? null : 'Missing configuration'
        }
      }));
    } catch (error) {
      setApiStatus(prev => ({
        ...prev,
        firebase: { 
          tested: true, 
          working: false, 
          error: String(error) 
        }
      }));
    }
  };

  const runApiTests = async () => {
    setIsTestingApi(true);
    await Promise.all([
      testOpenAIConnection(),
      testFirebaseConnection()
    ]);
    setIsTestingApi(false);
  };

  const testMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Successfully got microphone access
      setMicStatus({
        tested: true,
        available: true,
        error: null
      });
      // Important: Stop all tracks to release the microphone
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setMicStatus({
        tested: true,
        available: false,
        error: String(error)
      });
    }
  };

  const startRecording = async () => {
    try {
      recordingChunks.current = []; // Reset chunks
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio context and analyser
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Create recorder
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(recordingChunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(100); // Record in 100ms chunks
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Start visualization
      drawWaveform();
    } catch (error) {
      console.error('Recording setup error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      
      // Stop visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
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

  const handlePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(error => {
            console.error('Playback error:', error);
          });
      }
    }
  };

  // Clean up URLs when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="dream-studio-container">
      <div className="app-header">
        <img src={logo} alt="Dream Factory" className="logo" />
        <h1>Dream Factory Test</h1>
      </div>
      <div className="test-content">
        <p>Testing Firebase deployment</p>
        <button 
          onClick={() => setIsClicked(!isClicked)}
          className="test-button"
        >
          {isClicked ? 'Clicked!' : 'Click Me'}
        </button>
        
        <button 
          onClick={() => setShowEnvStatus(!showEnvStatus)}
          className="test-button env-button"
        >
          {showEnvStatus ? 'Hide Environment' : 'Show Environment'}
        </button>
        
        {showEnvStatus && (
          <div className="env-status">
            <h3>Environment Details</h3>
            <p>Build Mode: <span className="env-value">{envDetails.buildEnv}</span></p>
            <p>Base URL: <span className="env-value">{envDetails.baseUrl}</span></p>
            
            <h4>OpenAI Configuration</h4>
            <p>API Key: <span className={`env-value ${envDetails.envVars.openai.exists ? 'success' : 'error'}`}>
              {envDetails.envVars.openai.exists ? 'Present' : 'Missing'}
            </span></p>
            
            <h4>Firebase Configuration</h4>
            <ul className="env-list">
              <li>API Key: <span className={`env-value ${envDetails.envVars.firebase.apiKey ? 'success' : 'error'}`}>
                {envDetails.envVars.firebase.apiKey ? 'Present' : 'Missing'}
              </span></li>
              <li>Auth Domain: <span className={`env-value ${envDetails.envVars.firebase.authDomain ? 'success' : 'error'}`}>
                {envDetails.envVars.firebase.authDomain ? 'Present' : 'Missing'}
              </span></li>
              <li>Project ID: <span className={`env-value ${envDetails.envVars.firebase.projectId ? 'success' : 'error'}`}>
                {envDetails.envVars.firebase.projectId ? 'Present' : 'Missing'}
              </span></li>
            </ul>
          </div>
        )}

        <button 
          onClick={runApiTests}
          className="test-button api-button"
          disabled={isTestingApi}
        >
          {isTestingApi ? 'Testing APIs...' : 'Test API Connections'}
        </button>

        {(apiStatus.openai.tested || apiStatus.firebase.tested) && (
          <div className="api-status">
            <h3>API Status</h3>
            
            <div className="api-item">
              <h4>OpenAI API</h4>
              <p>Status: <span className={`status-badge ${apiStatus.openai.working ? 'success' : 'error'}`}>
                {apiStatus.openai.working ? 'Connected' : 'Failed'}
              </span></p>
              {apiStatus.openai.error && (
                <p className="error-message">Error: {apiStatus.openai.error}</p>
              )}
            </div>

            <div className="api-item">
              <h4>Firebase API</h4>
              <p>Status: <span className={`status-badge ${apiStatus.firebase.working ? 'success' : 'error'}`}>
                {apiStatus.firebase.working ? 'Connected' : 'Failed'}
              </span></p>
              {apiStatus.firebase.error && (
                <p className="error-message">Error: {apiStatus.firebase.error}</p>
              )}
            </div>
          </div>
        )}

        <button 
          onClick={testMicrophoneAccess}
          className="test-button mic-button"
          disabled={micStatus.tested && micStatus.available}
        >
          {micStatus.tested 
            ? (micStatus.available ? 'Microphone Access Granted' : 'Microphone Access Denied')
            : 'Test Microphone Access'}
        </button>

        <div className="recording-section">
          <canvas 
            ref={canvasRef} 
            width="600" 
            height="100" 
            className="waveform-canvas"
          />
          
          <div className="controls">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-button ${isRecording ? 'recording' : ''}`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            {audioUrl && !isRecording && (
              <>
                <button 
                  onClick={handlePlayback}
                  className={`playback-button ${isPlaying ? 'playing' : ''}`}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onEnded={() => setIsPlaying(false)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 