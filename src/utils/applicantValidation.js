import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Validar si un postulante puede hacer login
export const validateApplicantLogin = async (dni) => {
  try {
    const applicantDoc = await getDoc(doc(db, 'postulante', dni));
    
    if (!applicantDoc.exists()) {
      return {
        allowed: false,
        reason: 'Postulante no encontrado'
      };
    }
    
    const applicantData = applicantDoc.data();
    
    // Si no tiene status, está habilitado (legacy)
    if (!applicantData.status || applicantData.status === 'enabled') {
      return {
        allowed: true,
        reason: null
      };
    }
    
    // Si está deshabilitado
    if (applicantData.status === 'disabled') {
      return {
        allowed: false,
        reason: applicantData.disabledReason || 'Acceso deshabilitado'
      };
    }
    
    return {
      allowed: true,
      reason: null
    };
    
  } catch (error) {
    console.error('Error validating applicant:', error);
    return {
      allowed: false,
      reason: 'Error de validación'
    };
  }
};