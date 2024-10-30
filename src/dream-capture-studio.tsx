import React, { useEffect, useState, useRef } from 'react'
import './dream-capture-studio.css'
import logo from './img/logo.png';

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

  // Refs for audio visualization
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  const chunksRef = useRef<Blob[]>([]);

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
    if (!canvasRef.current || !audioRef.current) return;
    
    // Clean up existing nodes before creating new ones
    cleanupAudioNodes();
    
    // Create new audio context and nodes
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
    
    // Connect nodes
    sourceNodeRef.current.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);
    
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyserRef.current.getByteTimeDomainData(dataArray);

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

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        console.log('Got media stream');
        
        // Set up audio context and analyzer
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm', // Explicitly set format
        });
        
        recorder.ondataavailable = (e) => {
          console.log('Data chunk received:', e.data.size, 'bytes');
          if (e.data.size > 0) {
            setAudioChunks(prev => [...prev, e.data]);
          }
        };

        recorder.onstart = () => {
          console.log('Recording started');
          setIsRecording(true);
          setAudioChunks([]); // Clear previous chunks
          setAudioUrl(null); // Clear previous URL
          drawWaveform();
        };

        recorder.onstop = () => {
          console.log('Recording stopped');
          setIsRecording(false);
          
          // Important: Use the current audioChunks here
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log('Created blob:', blob.size, 'bytes');
          
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }
          
          const url = URL.createObjectURL(blob);
          console.log('Created audio URL:', url);
          setAudioUrl(url);
        };

        setMediaRecorder(recorder);
      })
      .catch(err => console.error('Media stream error:', err));

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const setupPlaybackAudioContext = () => {
    if (!audioRef.current) return;
    
    // Only create new audio context and nodes if they don't exist
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
  };

  const handlePlayPause = async () => {
    if (!audioRef.current || !audioUrl) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const stopAllMediaTracks = () => {
    console.log('=== STOPPING ALL MEDIA TRACKS ===');
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind}`);
        track.stop();
        track.enabled = false;
      });
      mediaStreamRef.current = null;
    }
  };

  const handleRecordToggle = () => {
    if (isRecording && mediaRecorder) {
      console.log('=== STOPPING RECORDING ===');
      mediaRecorder.stop();
      stopAllMediaTracks();
      setIsRecording(false);
      setMediaRecorder(null);
    } else {
      console.log('=== STARTING RECORDING ===');
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          mediaStreamRef.current = stream;
          setupAudioContext(stream);
          
          const recorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
          });
          
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              console.log('Data chunk received:', e.data.size, 'bytes');
              chunksRef.current.push(e.data);
            }
          };

          recorder.onstart = () => {
            console.log('Recording started');
            setIsRecording(true);
            chunksRef.current = []; // Clear previous chunks
            setAudioUrl(null);
            drawWaveform();
          };

          recorder.onstop = () => {
            console.log('Recording stopped, processing chunks...');
            setIsRecording(false);
            
            const finalBlob = new Blob(chunksRef.current, { 
              type: 'audio/webm;codecs=opus' 
            });
            console.log('Created blob:', finalBlob.size, 'bytes');
            
            if (audioUrl) {
              URL.revokeObjectURL(audioUrl);
            }
            
            const url = URL.createObjectURL(finalBlob);
            console.log('Created audio URL:', url);
            setAudioUrl(url);
            setAudioBlob(finalBlob); // Save blob for transcription
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            setHasRecorded(true);
          };

          setMediaRecorder(recorder);
          recorder.start(1000);
          console.log('2. Started recording');
        })
        .catch(err => console.error('Media stream error:', err));
    }
  };

  const handleSaveDream = async () => {
    console.log('=== SAVING DREAM ===');
    console.log('Audio blob:', audioBlob);
    
    if (!audioBlob) {
      console.error('No audio blob available');
      return;
    }
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found');
      return;
    }

    try {
      setIsTranscribing(true);
      
      // Create FormData and append the audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      
      console.log('Sending request to OpenAI...');
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Transcription received:', data);
      
      setTranscript(data.text);
      setShowTranscript(true);
      
    } catch (error) {
      console.error('Transcription error:', error);
      // Revert to previous state if needed
      setShowTranscript(false);
    } finally {
      setIsTranscribing(false);
    }
  };

  const analyzeDream = async () => {
    if (!transcript) return;
    
    try {
      setIsAnalyzing(true);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: "You are a dream analyst. Analyze the dream in a friendly, insightful way. Focus on symbolism, emotions, and potential meanings. Keep the tone light but thoughtful."
            },
            {
              role: "user",
              content: `Please analyze this dream: ${transcript}`
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      setAnalysis(data.choices[0].message.content);
      setShowAnalysis(true);
      
    } catch (error) {
      console.error('Analysis error:', error);
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

  return (
    <div className="dream-studio-container">
      {showTranscript ? (
        // Transcript screen
        <div className="transcript-view">
          <div className="app-header">
            <img src={logo} alt="Dream Factory" className="logo" />
            <div className="header-icons"> 
              <button aria-label="stats">📊</button>
              <button aria-label="profile">👤</button>
            </div>
          </div>

          <h2 className="studio-title">transcript</h2>
          
          <div className="transcript-text">
            {isTranscribing ? (
              <div className="loading-text">Transcribing your dream...</div>
            ) : (
              transcript
            )}
          </div>

          <button 
            className="analyze-button"
            onClick={analyzeDream}
          >
            analyze dream
          </button>
        </div>
      ) : (
        // Recording screen (existing view)
        <>
          <div className="app-header">
            <img src={logo} alt="Dream Factory" className="logo" />
            <div className="header-icons"> 
              <button aria-label="stats">📊</button>
              <button aria-label="profile">👤</button>
            </div>
          </div>

          <h2 className="studio-title">dream capture studio</h2>

          <div className="toggle-container">
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={autoRecord}
                onChange={(e) => setAutoRecord(e.target.checked)}
              />
              <span className="slider"></span>
            </div>
            <span className="toggle-text">Auto record dreams</span>
          </div>

          <div className="waveform">
            <canvas 
              ref={canvasRef}
              width={800}
              height={200}
              className={`waveform-canvas ${isRecording ? 'active' : ''}`}
            />
          </div>

          <div className="controls-container">
            <button 
              className="record-button" 
              onClick={handleRecordToggle}
            >
              {!hasRecorded && !isRecording ? (
                <span className="record-label">REC</span>
              ) : (
                <span className="play-icon">
                  {isRecording ? '❚❚' : '▶'}
                </span>
              )}
            </button>
            {(isRecording || hasRecorded) && (
              <div className="status-text">
                dream {isRecording ? 'recording..' : 'paused'}
              </div>
            )}
            {!isRecording && hasRecorded && (
              <button 
                className="save-button"
                onClick={handleSaveDream}
              >
                save dream
              </button>
            )}
            <audio 
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default DreamCaptureStudio;
