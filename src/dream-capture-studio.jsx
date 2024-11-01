// // import React from 'react';


// import React, { useState } from 'react';

// export default function DreamCaptureStudio() {
//     return <div>Dream Capture Studio</div>;
//   }

// // Remove TypeScript type annotations
// const [selectedDream, setSelectedDream] = useState(null);
// const [showDreamDetail, setShowDreamDetail] = useState(false);

// // Simplify the handler
// const handleDreamSelect = (dream) => {
//   setSelectedDream(dream);
//   setShowDreamDetail(true);
// };

// return <div>Dream Capture Studio</div>;

// // In the JSX, update references to optional chaining
// <div className="dream-detail-screen">
//   <div className="app-header">
//     <img src={logo} alt="Dream Factory" className="logo" />
//     <div className="header-icons">
//       <button className="stats-icon">📊</button>
//       <button className="profile-icon">👤</button>
//     </div>
//   </div>

//   <h1 className="dream-library-title">dream library</h1>
  
//   <div className="dream-detail-content">
//     <div className="dream-detail-header">
//       <h2 className="dream-detail-title">
//         {selectedDream ? selectedDream.title : 'dream title'}
//       </h2>
//       <span className="dream-detail-date">
//         {selectedDream ? selectedDream.date : '09-13-24'}
//       </span>
//     </div>

//     <div className="dream-detail-image">
//       {selectedDream && selectedDream.imageUrl ? (
//         <img src={selectedDream.imageUrl} alt="Dream visualization" />
//       ) : (
//         <div className="dream-image-placeholder">
//           {/* Add placeholder content if needed */}
//         </div>
//       )}
//     </div>

//     <div className="dream-detail-analysis">
//       <div className="analysis-label">Analysis generated:</div>
//       <div className="analysis-text">
//         {selectedDream ? selectedDream.analysis : ''}
//       </div>
//     </div>

//     <button 
//       className="back-button"
//       onClick={() => {
//         setShowDreamDetail(false);
//         setSelectedDream(null);
//       }}
//     >
//       back to library
//     </button>
//   </div>
// </div> 