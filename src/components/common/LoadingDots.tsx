import React from 'react';
import './LoadingDots.css';

interface LoadingDotsProps {
  text: string;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({ text }) => {
  return (
    <div className="loading-text">
      {text}<span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>
    </div>
  );
};

export default LoadingDots; 