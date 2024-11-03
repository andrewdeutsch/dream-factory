interface DreamCardProps {
  id: string;
  title: string;
  imageUrl?: string;
  date: string;
  onClick?: () => void; 
}

export const DreamCard: React.FC<DreamCardProps> = ({
  id,
  title,
  imageUrl,
  date,
  onClick 
}) => {
  console.log('DreamCard rendered:', id);

  return (
    <div 
      className="dream-card"
      onClick={onClick}  // Add this line
      role="button"     // Optional: for accessibility
      tabIndex={0}      // Optional: for keyboard navigation
    >
      <div className="dream-card-image">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt="Dream visualization" 
            className="dream-image"
            onError={(e) => {
              console.error('Image load error:', {
                imageUrl,
                dreamId: id
              });
              e.currentTarget.src = '/placeholder.png';
            }} 
          />
        ) : (
          <div className="placeholder-image">
            <span>✨ Dream Recorded ✨</span>
            {process.env.NODE_ENV === 'development' && (
              <small style={{display: 'block', fontSize: '0.8em', color: '#666'}}>
                ID: {id}
              </small>
            )}
          </div>
        )}
      </div>
      <div className="dream-card-info">
        <h2 className="dream-card-title">{title || 'Untitled Dream'}</h2>
        <span className="dream-card-date">{date}</span>
      </div>
    </div>
  );
}; 