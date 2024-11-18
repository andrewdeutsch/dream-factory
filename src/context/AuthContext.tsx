import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithRedirect,
  deleteUser,
  getRedirectResult
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;  // Single sign-out method
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        // If logged in and on login/root, redirect to dreams
        if (window.location.pathname === '/login' || window.location.pathname === '/') {
          navigate('/dreams');
        }
      } else {
        // If logged out, force redirect to root
        if (window.location.pathname !== '/') {
          navigate('/', { replace: true });
        }
      }
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('Google sign in successful:', result.user);
          navigate('/dreams');
        }
      })
      .catch((error) => {
        console.error('Error getting redirect result:', error);
      });
  }, [auth, navigate]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      console.log('Sign in successful, user:', result.user);
      console.log('Current location:', window.location.pathname);
      
      if (result.user) {
        navigate('/dreams', { replace: true });
      }
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || 
          error.code === 'auth/popup-closed-by-user') {
        console.log('Popup closed by user');
        return;
      }
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dreams');
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/dreams');
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };


  const deleteAccount = async () => {
    if (!user) return;
    try {
      await deleteUser(user);
      // You might want to also delete user data from Firestore here
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signIn,
    signUp,
    signOut,  // Use the single signOut method
    deleteAccount
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signInWithGoogle,
      signIn,
      signUp,
      signOut,  // Use signOut instead of logout
      deleteAccount
      }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

