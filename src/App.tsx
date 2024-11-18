import { AuthProvider } from './context/AuthContext';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Login } from './components/auth/Login';
import { SignUp } from './components/auth/SignUp';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LandingPage } from './components/LandingPage';
import DreamCaptureStudio from './dream-capture-studio.tsx';
import { LibraryPage } from './components/LibraryPage';
import { DreamDetail } from './components/library/DreamDetail'; 
import { ProfilePage } from './components/ProfilePage';  

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* <Route path="/" element={<LandingPage />} /> */}
          <Route path="/" element={<Login />} />
          {/* <Route path="/signup" element={<SignUp />} /> */}
          <Route 
            path="/dreams" 
            element={
              <ProtectedRoute>
                <DreamCaptureStudio />
              </ProtectedRoute>
            } 
          />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/dream/:dreamId" element={<DreamDetail />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App; 