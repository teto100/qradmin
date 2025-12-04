import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Settings, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    autoAnalysisWeight: 80,
    iaBackWeight: 20,
    iaFrontWeight: 10,
    maxIABackPenalty: 25,
    maxIAFrontPenalty: 5
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'system_settings', 'scoring');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setSettings({ ...settings, ...docSnap.data() });
      }
    } catch (error) {
      logger.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'system_settings', 'scoring');
      await setDoc(docRef, settings);
      toast.success('Configuración guardada exitosamente');
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings({ ...settings, [field]: parseInt(value) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '16rem' }}>
        <div className="animate-spin rounded-full" style={{ 
          width: '2rem', 
          height: '2rem', 
          border: '2px solid #e5e7eb', 
          borderTop: '2px solid #009EE4' 
        }}></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Settings size={24} className="mr-2" />
          Configuración del Sistema
        </h1>
        <p className="text-gray-600">Ajusta los parámetros de evaluación para todas las pruebas</p>
      </div>

      <div className="card max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Pesos de Evaluación (Total: 100 puntos)
        </h2>
        
        <div className="space-y-6">
          <div>
            <label className="form-label">Análisis Automático (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.autoAnalysisWeight}
              onChange={(e) => handleChange('autoAnalysisWeight', e.target.value)}
              className="form-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Peso del análisis de similitud con respuesta esperada
            </p>
          </div>

          <div>
            <label className="form-label">Control IA Back (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.iaBackWeight}
              onChange={(e) => handleChange('iaBackWeight', e.target.value)}
              className="form-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Peso del análisis de humanidad mejorado
            </p>
          </div>

          <div>
            <label className="form-label">Control IA Front (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.iaFrontWeight}
              onChange={(e) => handleChange('iaFrontWeight', e.target.value)}
              className="form-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Peso del análisis de IA original del sistema
            </p>
          </div>

          <hr className="my-6" />

          <h3 className="text-md font-semibold text-gray-900 mb-4">
            Penalizaciones Máximas por Uso de IA
          </h3>

          <div>
            <label className="form-label">Penalización Máxima IA Back (%)</label>
            <input
              type="number"
              min="0"
              max="50"
              value={settings.maxIABackPenalty}
              onChange={(e) => handleChange('maxIABackPenalty', e.target.value)}
              className="form-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Máximo descuento por detección de IA en análisis Back
            </p>
          </div>

          <div>
            <label className="form-label">Penalización Máxima IA Front (%)</label>
            <input
              type="number"
              min="0"
              max="20"
              value={settings.maxIAFrontPenalty}
              onChange={(e) => handleChange('maxIAFrontPenalty', e.target.value)}
              className="form-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Máximo descuento por detección de IA en análisis Front
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Vista Previa del Cálculo:</h4>
            <p className="text-sm text-blue-800">
              <strong>Puntaje Base:</strong> Análisis Automático ({settings.autoAnalysisWeight}%) + IA Back ({settings.iaBackWeight}%) + IA Front ({settings.iaFrontWeight}%)
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Penalizaciones:</strong> Hasta -{settings.maxIABackPenalty}% por IA Back + Hasta -{settings.maxIAFrontPenalty}% por IA Front
            </p>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="btn btn-primary flex items-center space-x-2 w-full"
          >
            <Save size={16} />
            <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;