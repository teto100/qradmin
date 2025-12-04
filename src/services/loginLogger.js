import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

class LoginLogger {
  static async logLogin(userId) {
    try {
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const loginData = {
        userId,
        sessionId,
        loginAt: serverTimestamp(),
        ipAddress: await this.getIP(),
        userAgent: navigator.userAgent,
        browser: this.getBrowser(),
        os: this.getOS(),
        device: this.getDevice(),
        location: await this.getLocation(),
        appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
        status: 'active'
      };

      const docRef = await addDoc(collection(db, 'login_logs'), loginData);
      
      localStorage.setItem('sessionId', sessionId);
      localStorage.setItem('loginDocId', docRef.id);
      
      return { sessionId, docId: docRef.id };
    } catch (error) {
      console.error('Error registrando login:', error);
      throw error;
    }
  }

  static async logLogout() {
    const docId = localStorage.getItem('loginDocId');
    if (docId) {
      await updateDoc(doc(db, 'login_logs', docId), {
        logoutAt: serverTimestamp(),
        status: 'logged_out'
      });
    }
    localStorage.removeItem('sessionId');
    localStorage.removeItem('loginDocId');
  }

  static async logFailedLogin(email, errorCode) {
    try {
      const loginData = {
        userId: email,
        sessionId: null,
        loginAt: serverTimestamp(),
        ipAddress: await this.getIP(),
        userAgent: navigator.userAgent,
        browser: this.getBrowser(),
        os: this.getOS(),
        device: this.getDevice(),
        location: await this.getLocation(),
        appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
        status: 'failed',
        errorCode
      };

      await addDoc(collection(db, 'login_logs'), loginData);
    } catch (error) {
      console.error('Error registrando login fallido:', error);
    }
  }

  static async getIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  static async getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: null, longitude: null, city: 'unknown', country: 'unknown' });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            resolve({
              latitude,
              longitude,
              city: data.city || 'unknown',
              country: data.countryName || 'unknown'
            });
          } catch {
            resolve({ latitude, longitude, city: 'unknown', country: 'unknown' });
          }
        },
        () => resolve({ latitude: null, longitude: null, city: 'unknown', country: 'unknown' }),
        { timeout: 5000 }
      );
    });
  }

  static getBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  static getOS() {
    const ua = navigator.userAgent;
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  static getDevice() {
    return /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  }
}

export default LoginLogger;