import React, { useEffect, useState, useRef, storageRef } from 'react'
import './dream-capture-studio.css'
import logo from './img/logo.png';
import { LibraryPage } from './components/LibraryPage';
import { useAuth } from './context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { db } from './config/firebase';
import { Header } from './components/common/Header';
import LoadingDots from './components/common/LoadingDots';
type UploadType = 'audio' | 'image';

import { 
  collection, 
  getDocs,
  doc,
  setDoc,
  getFirestore 
} from 'firebase/firestore';
import { getStorage, ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Cloudinary } from '@cloudinary/url-gen';
import { v4 as uuidv4 } from 'uuid';
import SHA256 from 'crypto-js/sha256';

  // Development error handling
  if (process.env.NODE_ENV === 'development') {
    const originalError = console.error;
    console.error = (...args) => {
      // Check if first argument is a string before calling includes
      if (typeof args[0] === 'string' && args[0].includes('chrome-extension://')) {
        return;
      }
      originalError.apply(console, args);
    };
  }

// Initialize Cloudinary
const cloudinary = new Cloudinary({
  cloud: {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
    apiKey: import.meta.env.VITE_CLOUDINARY_API_KEY,
    apiSecret: import.meta.env.VITE_CLOUDINARY_API_SECRET
  }
});
const getSecureUrl = (publicId: string, resourceType: 'video' | 'image') => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;
  
  // Generate signature for retrieval
  const signatureString = [
    `public_id=${publicId}`,
    `timestamp=${timestamp}`
  ].join('&') + apiSecret;
  
  const signature = SHA256(signatureString).toString();
  
  return `https://res.cloudinary.com/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/${resourceType}/authenticated/${publicId}?timestamp=${timestamp}&signature=${signature}`;
};

// // Usage when displaying assets:
// const audioUrl = getSecureUrl(publicId, 'video');
// const imageUrl = getSecureUrl(imagePublicId, 'image');

// Test the connection
console.log('Cloudinary initialized with cloud name:', import.meta.env.VITE_CLOUDINARY_CLOUD_NAME);

const DreamCaptureStudio: React.FC = () => {
  const { user } = useAuth(); 

  

  const generateSecureUploadParams = (type: UploadType) => {
    if (!user) throw new Error('No user authenticated');
    const publicId = `${user.uid}_${uuidv4()}`;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;  
    const folder = type === 'audio' ? 'dreams/audio' : 'dreams/images';

    const uploadPreset = type === 'audio' 
    ? import.meta.env.VITE_CLOUDINARY_AUDIO_PRESET 
    : import.meta.env.VITE_CLOUDINARY_IMAGE_PRESET;

  
      // Log parameters used for signature (without exposing secrets)
    console.log('Signature parameters:', {
      timestamp,
      uploadPreset,
      hasApiSecret: !!apiSecret,
      hasApiKey: !!apiKey,
      publicId
    });
    
    // Generate the signature
    const signatureString = [
      'access_mode=authenticated',
      `folder=${folder}`,
      `public_id=${publicId}`,
      `timestamp=${timestamp}`,
      'type=authenticated',
      `upload_preset=${uploadPreset}`
    ].join('&') + apiSecret;

    const signature = SHA256(signatureString).toString();

    console.log(`Generating ${type} upload parameters for folder:`, folder);

    console.log('Generated secure params:', {
      timestamp,
      uploadPreset,
      publicId,
      signatureString: signatureString.replace(apiSecret, '[REDACTED]') // Log without exposing API secret
    });
    
    return {
      timestamp,
      signature,
      publicId,
      apiKey,
      folder,
      uploadPreset
    };
  };
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
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState<string>('');

  const handleEditClick = () => {
    setIsEditing(true);
    setEditedTranscript(transcript || '');
  };
  const handleSaveEdit = () => {
    setTranscript(editedTranscript);
    setIsEditing(false);
  };

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
    imageUrl: string;
  } | null>(null);

  // Add this with your other state declarations
  const [dreams, setDreams] = useState<any[]>([]);

  const [isTranscriptOverflowing, setIsTranscriptOverflowing] = useState(false);
  const [isAnalysisOverflowing, setIsAnalysisOverflowing] = useState(false);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const analysisRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkOverflow = (element: HTMLDivElement | null) => {
      if (!element) {
        console.log('No element found');
        return false;
    }
      const textContainer = element.querySelector('.transcript-text-container, .analysis-text-container');
      if (!textContainer) return false;
      
      // Get the paragraph element
      const textElement = textContainer.querySelector('.transcript-text, .analysis-text');
      if (!textElement) return false;
  
      const isOverflowing = textElement.scrollHeight > textContainer.clientHeight;
      
      console.log('Overflow check:', {
        textHeight: textElement.scrollHeight,
        containerHeight: textContainer.clientHeight,
        isOverflowing,
        text: textElement.textContent
    });
    console.log('Overflow check:', {
      textHeight: textElement.scrollHeight,
      containerHeight: textContainer.clientHeight,
      isOverflowing,
      text: textElement.textContent
    });
      
      return isOverflowing;
    };
  
    // Add a small delay to ensure content is rendered
    setTimeout(() => {
      const transcriptOverflow = checkOverflow(transcriptRef.current);
      const analysisOverflow = checkOverflow(analysisRef.current);
      setIsTranscriptOverflowing(transcriptOverflow);
      setIsAnalysisOverflowing(analysisOverflow);
    }, 100);
  }, [transcript, analysis, isExpanded]);

  // useEffect(() => {
  //   const textarea = document.querySelector('.transcript-edit-area');
  //   if (textarea) {
  //     // Reset height first
  //     textarea.style.height = '0px';
  //     // Then set to scrollHeight
  //     textarea.style.height = textarea.scrollHeight + 'px';
  //   }
  // }, [editedTranscript]);

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedTranscript(e.target.value);
    requestAnimationFrame(() => adjustHeight(e.target));
  };
  
  const adjustHeight = (element: HTMLTextAreaElement) => {
    element.style.height = '0';  // Collapse to get the right scrollHeight
    const scrollHeight = element.scrollHeight;
    element.style.height = `${scrollHeight}px`;
  };
  
  // Add this effect to handle initial height adjustment when editing starts
  useEffect(() => {
    if (isEditing) {
      const textarea = document.querySelector('.transcript-edit-area') as HTMLTextAreaElement;
      if (textarea) {
        requestAnimationFrame(() => adjustHeight(textarea));
      }
    }
  }, [isEditing, editedTranscript]);

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
    // Clear any existing error when starting a new recording attempt
    setRecordingError(null);

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
          } else {
            setRecordingError('Unable to start recording. Please check your microphone settings.');
          }
        })
        .catch(err => {
          console.error('Media stream error:', err);
          let errorMessage = 'Unable to access microphone. ';
          if (err.name === 'NotAllowedError') {
            errorMessage += 'Please allow microphone access.';
          } else if (err.name === 'NotFoundError') {
            errorMessage += 'No microphone found.';
          } else {
            errorMessage += 'Please check your device settings.';
          }
          setRecordingError(errorMessage);
          setIsRecording(false);
        });
    }
  };

  const handleRecordAgain = () => {
    // Reset all relevant states
    setIsRecording(true);
    setHasRecorded(false);
    setIsRecording(false);
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscript(null);
    setShowTranscript(false);
    
    // Clean up audio resources
    stopAllMediaTracks();
    cleanupAudioNodes();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  
    // Automatically start new recording
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaStreamRef.current = stream;
        setupAudioContext(stream);
        
        const recorder = setupRecorder(stream);
        if (recorder) {
          setMediaRecorder(recorder);
          chunksRef.current = [];
          recorder.start(100);
        } else {
          setRecordingError('Unable to start recording. Please check your microphone settings.');
        }
      })
      .catch(err => {
        console.error('Media stream error:', err);
        let errorMessage = 'Unable to access microphone. ';
        if (err.name === 'NotAllowedError') {
          errorMessage += 'Please allow microphone access.';
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'No microphone found.';
        } else {
          errorMessage += 'Please check your device settings.';
        }
        setRecordingError(errorMessage);
        setIsRecording(false);
      });
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
                content: "Generate a concise 2-3 word title for this dream. Use simple, descriptive words. Avoid emotional or flowery language. Do not include any quotation marks in your response. Limit word count to 100."
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
                content: `Analyze this dream: ${transcript}. Do not mention your neutrality as a dream interpreter`
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

      const title = titleData.choices[0].message.content.replace(/['"]+/g, ''); 
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
  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
  };

  // Update the library button handler
  const handleSaveToLibrary = async () => {
    if (!user || !audioBlob) return;

  try {
    setIsSaving(true);
    console.log('Starting save to library process');
    
    const { timestamp, signature, publicId, apiKey, folder, uploadPreset } = generateSecureUploadParams();

    if (!apiKey) {
      console.error('API Key is missing from environment variables');
      throw new Error('Missing Cloudinary API key');
    }


    // Create a file from the blob with explicit extension
    const audioFile = new File([audioBlob], 'audio.webm', { 
      type: audioBlob.type || 'audio/webm;codecs=opus' 
    });

    // Debug log the upload parameters
    console.log('Debug Info:', {
      cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!import.meta.env.VITE_CLOUDINARY_API_KEY,
      hasApiSecret: !!import.meta.env.VITE_CLOUDINARY_API_SECRET,
      hasUploadPreset: !!import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
      timestamp,
      signatureLength: signature?.length,
      publicId,
      audioType: audioBlob.type,
      audioSize: audioBlob.size
    });


    // Create FormData for audio upload
    const audioFormData = new FormData();
    audioFormData.append('file', audioBlob);
    audioFormData.append('api_key', apiKey);
    audioFormData.append('timestamp', timestamp.toString());
    audioFormData.append('signature', signature);
    audioFormData.append('public_id', publicId);
    audioFormData.append('folder', folder);
    audioFormData.append('access_mode', 'authenticated');
    audioFormData.append('type', 'authenticated');
    audioFormData.append('upload_preset', uploadPreset);

    console.log('FormData contents:', {
      api_key: 'PRESENT',
      file: 'BLOB',
      upload_preset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
      timestamp,
      signature: 'PRESENT',
      public_id: publicId,
      resource_type: 'video'
    });

    // Log the full URL being used
    console.log('Upload URL:', `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`);

    // Upload audio with secure parameters
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`,
      {
        method: 'POST',
        body: audioFormData
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload failed with status:', uploadResponse.status);
      console.error('Response headers:', Object.fromEntries([...uploadResponse.headers]));
      console.error('Raw response:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Error details:', {
          error: errorJson.error,
          message: errorJson.error?.message,
          statusCode: uploadResponse.status
        });
      } catch (e) {
        console.error('Could not parse error response as JSON');
      }
      
      throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    const audioData = await uploadResponse.json();
    const secureAudioUrl = getSecureUrl(audioData.public_id, 'video');
    console.log('Audio uploaded successfully:', secureAudioUrl);
    
    // Add these logs to debug the upload
    console.log('Audio file type:', audioFile.type);
    console.log('Audio file size:', audioFile.size);

    //formData.append('file', audioBlob);
    audioFormData.append('upload_preset', 'dream_audio'); // Create this preset in Cloudinary
    




      // Generate and upload the image
      console.log('Starting image generation');
      const imageUrl = await generateDreamImage();
      
      if (!imageUrl) {
        throw new Error('Failed to generate or upload image');
      }
      console.log('Successfully generated and uploaded image:', imageUrl);

      // Get user's locale and timezone info
      const userLocale = navigator.language || 'en-US';
      const userDate = new Date();
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      console.log('User locale:', userLocale);
      console.log('User timezone:', userTimezone);
      console.log('Local date/time:', userDate.toString());
      
      // Format the date (MM-DD-YY)
      const formattedDate = userDate.toLocaleDateString(userLocale, {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
        timeZone: userTimezone
      }).replace(/[/\.]/g, '-');
      
      console.log('Formatted local date:', formattedDate);
      console.log('Dream image before saving:', imageUrl);

      // Create dream data object with the permanent image URL
      const dreamData = {
        title: dreamTitle || 'Untitled Dream',
        transcript: transcript || '',
        analysis: analysis || '',
        imageUrl: imageUrl,
        audioUrl: audioUrl,
        date: formattedDate,
        timestamp: userDate.toISOString(),
        userId: user.uid,
        createdAt: userDate.getTime()
      };

      // Set current dream data
      setCurrentDreamData(dreamData);
      console.log('Dream data object created:', dreamData);

      // Save to Firestore
      const dreamRef = doc(collection(db, 'users', user.uid, 'dreams'));
      await setDoc(dreamRef, dreamData);

      console.log('Dream saved successfully with ID:', dreamRef.id);

      // Navigate to library page
      navigate('/library');

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
      console.log('Starting DALL-E image generation...');
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `Create a plain, realistic image interpreting this dream: ${analysis}. Style: photorealistic, soft, even lighting, natural tones, minimal shadows, with a calm and balanced atmosphere.`,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        })
      });

      const data = await response.json();
      const base64Data = data.data[0].b64_json;
      
      // Upload to Cloudinary
      const { timestamp, signature, publicId, apiKey, folder, uploadPreset } = generateSecureUploadParams();
      
      console.log('Upload configuration:', {
        preset: uploadPreset,
        folder,
        cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
        hasApiKey: !!apiKey
      });

      console.log('Image upload parameters:', {
        folder,
        uploadPreset,
        hasApiKey: !!apiKey,
        timestamp
      });

      if (!apiKey) {
        throw new Error('Missing Cloudinary API key');
      }

      const formData = new FormData();
      formData.append('file', `data:image/png;base64,${base64Data}`);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('public_id', publicId);
      formData.append('folder', folder); 
      formData.append('type', 'authenticated'); 
      formData.append('access_mode', 'authenticated');
      formData.append('upload_preset', 'dream_images');

      const uploadUrl = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;
      console.log('Uploading to:', uploadUrl);
      console.log('Upload URL:', `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`);
      console.log('FormData keys:', Array.from(formData.keys()));

      
      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      const imageData = await uploadResponse.json();
      
      if (!uploadResponse.ok) {
        console.error('Cloudinary error:', imageData);
        throw new Error(`Cloudinary upload failed: ${imageData.error?.message || 'Unknown error'}`);
      }

      console.log('Successfully uploaded to Cloudinary:', imageData);

      const imageUrl = imageData.secure_url;
      console.log('Setting image URL:', imageUrl); // Debug log
      setImageUrl(imageUrl);
      return imageUrl;

    } catch (error) {
      console.error('Error in generateDreamImage:', error);
      return null;
    } finally {
      setIsGeneratingImage(false);
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
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      } else {  

        if (!audioUrl) {
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          audioRef.current.src = url;
        }

        // audioRef.current.src = audioUrl;
        await audioRef.current.load();
        await audioRef.current.play();
        setIsPlaying(true);
        drawPlaybackWaveform();
      }
    } catch (err) {
      console.error('Playback error details:', err);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      });
  
      // Clean up on unmount
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('ended', () => {
            setIsPlaying(false);
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
          });
        }
      };
    }
  }, [audioRef.current]);

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

  const navigate = useNavigate();

  return (
    <div className="dream-studio-container">
      <Header 
        hasExistingDreams={hasExistingDreams || showLibrary}
        onLibraryClick={() => navigate('/library')}
        onProfileClick={() => navigate('/profile')}
      />
      <audio 
        ref={audioRef} 
        src={audioUrl || ''} 
        preload="auto"
        onError={(e) => console.error('Audio element error:', e)}
      />

      {showDreamDetail ? (
        <div className="dream-detail-screen">
          
          <h1 className="dream-library-title">dream library</h1>
          
          <div className="dream-detail-content">
            <div className="dream-title-container">
              <h2 className="dream-title">{selectedDream?.title}</h2>
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
          

          <h1 className="library-title">dream library</h1>

          <div className="dream-cards-container">
            {currentDreamData && (
              <div 
                className="dream-card"
                onClick={() => handleDreamSelect({
                  id: 1, // Add an ID if needed
                  title: currentDreamData.title,
                  date: currentDreamData.date,
                  imageUrl: currentDreamData.imageUrl || '', // Changed from dreamImage
                  transcript: currentDreamData.transcript,
                  analysis: currentDreamData.analysis
                })}
              >
                <div className="dream-card-image">
                  {currentDreamData.imageUrl ? (
                    <img src={imageUrl} alt="Dream visualization" className="dream-image" />
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

          <h2 className="dream-analysis-title">{dreamTitle}</h2>           

          <div className="analysis-content">
          <div className={`analysis-container ${isExpanded ? 'expanded' : ''}`} ref={analysisRef}>

              <div className={`analysis-text-container ${isExpanded ? 'expanded' : ''}`}>
                <p className="analysis-text">{analysis}</p>
              </div>
              {(isAnalysisOverflowing || isExpanded) && (
                <span 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="more-text"
                >
                  {isExpanded ? 'less' : 'more'}
                </span>
              )}
           
            </div>
          </div>
          <button 
              onClick={handleSaveToLibrary}
              className="library-button"
              disabled={isSaving}
            >
              {isSaving ? <LoadingDots text="saving to library" /> : 'save dream to library'}
            </button>
        </div>
      ) : showTranscript ? (
        // Transcript screen
        <div className="transcript-screen">

          {/* <h1 className="studio-title studio-title-transcript">dream capture studio</h1> */}
          
          <div className="transcript-content">
            <div className="transcript-label">transcript

            <div className="playback-controls">
            <img 
              src={isPlaying ? "/audio-icon-on.png" : "/audio-icon-off.png"}
              alt="Play/Pause"
              className="audio-icon"
              onClick={handlePlayPause}
            style={{ cursor: 'pointer' }}
              />
            </div>
            </div>
            
            <div className={`transcript-container ${isExpanded ? 'expanded' : ''}`} ref={transcriptRef}>
            <div className="transcript-actions">
              <button 
                onClick={isEditing ? handleSaveEdit : handleEditClick}
                className="edit-button"
              >
                {isEditing ? 'save' : 'edit'}
              </button>
              <div className={`transcript-text-container ${isExpanded ? 'expanded' : ''}`}>
              {isEditing ? (
                  <textarea
                  className="transcript-edit-area"
                  value={editedTranscript}
                  onChange={handleTextAreaChange}
                  autoFocus
                />
                ) : (
                <p className="transcript-text">{transcript}</p>
              )}
              </div>
              {/* {(isTranscriptOverflowing || isExpanded) && 
                <span 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="more-text"
                >
                  {isExpanded ? 'less' : 'more'}
                </span>
              } */}
            </div>
            
            
            </div>
            <button 
              onClick={() => analyzeDream(transcript || '')}
              className="analyze-button"
              disabled={isAnalyzing || !transcript}
            >
              {isAnalyzing ? <LoadingDots text="analyzing" /> : 'analyze dream'}
            </button>
          
        </div>
        </div>
      ) : (
        // Recording screen
        <>

          {/* <h1 className="studio-title">dream capture studio</h1> */}

          {/* Waveform */}
          <div className={`waveform ${hasRecorded || isRecording ? 'recording' : ''}`}>
            <canvas 
              ref={canvasRef} 
              className="waveform-canvas"
            />
          </div>

          {/* Add error message here, before the controls */}
        {recordingError && (
          <div className="recording-error" role="alert">
            {recordingError}
          </div>
        )}

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
              {isRecording ? 'recording...' : 
               isPlaying ? 'playing...' :
               hasRecorded ? 'tap to play' : 
               'tap to catch your dream'}
            </div>
          </div>

         

          {hasRecorded && !isRecording && (
        <div className="recorded-actions-container">
          <button 
            onClick={handleSaveDream}
            className="save-button"
            disabled={isTranscribing}
          >
            {isTranscribing ? <LoadingDots text="transcribing" /> : 'transcribe dream'}
          </button>

          <div className="record-again-container">
            <p className="record-again-text">did you miss anything?</p>
            <button 
              onClick={handleRecordAgain}
              className="record-again-button"
            >
              record again
            </button>
          </div>
        </div>
      )}
      </>
    )}
  </div>
);
};

export default DreamCaptureStudio;