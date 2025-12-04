import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import toast from 'react-hot-toast';

export const checkSessionValidity = async () => {
  try {
    // Solo verificar si el usuario está autenticado
    if (!auth.currentUser) {
      return false;
    }
    
    const configDoc = await getDoc(doc(db, 'app_config', 'main'));
    
    if (configDoc.exists()) {
      const config = configDoc.data();
      const currentVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
      
      // Verificar versión mínima requerida
      if (config.minAppVersion && isVersionLower(currentVersion, config.minAppVersion)) {
        await forceLogout('Versión de aplicación obsoleta. Por favor actualiza.');
        return false;
      }
      
      // Verificar si hay logout forzado global
      if (config.forceLogoutAll) {
        await forceLogout('Sesión cerrada por administrador.');
        return false;
      }
      
      // Verificar mantenimiento
      if (config.maintenanceMode) {
        await forceLogout('Sistema en mantenimiento. Intenta más tarde.');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking session validity:', error);
    return true; // En caso de error, permitir continuar
  }
};

export const forceLogout = async (message) => {
  try {
    await signOut(auth);
    localStorage.removeItem('lastLoginTime');
    toast.error(message);
    window.location.href = '/login';
  } catch (error) {
    console.error('Error during force logout:', error);
    window.location.href = '/login';
  }
};

export const setLastLoginTime = () => {
  localStorage.setItem('lastLoginTime', new Date().toISOString());
};

const isVersionLower = (current, required) => {
  const currentParts = current.split('.').map(Number);
  const requiredParts = required.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const requiredPart = requiredParts[i] || 0;
    
    if (currentPart < requiredPart) return true;
    if (currentPart > requiredPart) return false;
  }
  
  return false;
};