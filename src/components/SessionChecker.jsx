import { useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../config/firebase';
import { checkSessionValidity } from '../services/sessionManager';

const SessionChecker = ({ children }) => {
  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    if (user && !loading) {
      // Verificar sesión cada 5 minutos
      const interval = setInterval(async () => {
        await checkSessionValidity();
      }, 5 * 60 * 1000);

      // Verificar inmediatamente al cargar
      checkSessionValidity();

      return () => clearInterval(interval);
    }
  }, [user, loading]);

  return children;
};

export default SessionChecker;