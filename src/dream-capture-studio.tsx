import React, { useEffect, useState, useRef } from 'react'
import './dream-capture-studio.css'
import logo from './img/logo.png';
import { DreamLibrary } from './components/library/DreamLibrary';

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
    if (!audioBlob) return;
    
    try {
        setShowTranscript(true);
      setIsTranscribing(true);
      
      // Create FormData and append the audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      
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
      setTranscript(data.text);
      setShowTranscript(true); // Show transcript view
      
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const analyzeDream = async (transcript: string) => {
    try {
      setIsAnalyzing(true);
      
      // Generate title and analysis in parallel
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
                content: "Create a brief 2-3 word title for this dream. Be creative but concise."
              },
              {
                role: "user",
                content: transcript
              }
            ]
          })
        }),
        
        // Analysis generation (your existing analysis fetch)
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
                content: "You are a dream analyst. Analyze the dream with a focus on symbolism, emotions, and potential meanings. Keep the analysis concise but insightful."
              },
              {
                role: "user",
                content: `Please analyze this dream: ${transcript}`
              }
            ]
          })
        })
      ]);

      const titleData = await titleResponse.json();
      const analysisData = await analysisResponse.json();

      setDreamTitle(titleData.choices[0].message.content);
      setAnalysis(analysisData.choices[0].message.content);
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

  // Add current date formatting
  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
  };

  // Update the library button handler
  const handleAddToLibrary = async () => {
    try {
      // Show library view immediately with loading state
      setShowLibrary(true);
      setShowAnalysis(false);
      
      // Generate image
      await generateDreamImage();
      
    } catch (error) {
      console.error('Error adding to library:', error);
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
          prompt: `Create a dreamy, artistic interpretation of this dream: ${transcript}. Style: ethereal, painterly, surreal.`,
          n: 1,
          size: "1024x1024"
        })
      });

      const data = await response.json();
      setDreamImage(data.data[0].url);
      
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="dream-studio-container">
      {showLibrary && (
        <DreamLibrary 
          dreamTitle={dreamTitle || ''}
          dreamImage={dreamImage || ''}
          date={getCurrentDate()}
        />
      )}
    </div>
  );
};

export default DreamCaptureStudio;
