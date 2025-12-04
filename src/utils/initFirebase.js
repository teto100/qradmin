import { collection, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const initLoginLogsCollection = async () => {
  await addDoc(collection(db, 'login_logs'), {
    userId: 'system_init',
    sessionId: 'init_session',
    loginAt: serverTimestamp(),
    status: 'init',
    ipAddress: 'system',
    userAgent: 'system',
    browser: 'system',
    os: 'system',
    device: 'system',
    location: { latitude: 0, longitude: 0, city: 'system', country: 'system' },
    appVersion: '1.0.0'
  });
};

export const initAppConfig = async () => {
  await setDoc(doc(db, 'app_config', 'main'), {
    minAppVersion: '1.0.0',
    forceLogoutAll: false,
    forceLogoutTimestamp: null,
    maintenanceMode: false,
    allowedIPs: [],
    maxConcurrentSessions: 3,
    sessionTimeout: 3600,
    updatedAt: serverTimestamp(),
    updatedBy: 'system'
  });
};