import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Download, Trophy, AlertTriangle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';
import { calculateAutoAnalysis } from '../services/scoringService';

const ReportsPage = () => {
  const [testTypes, setTestTypes] = useState([]);
  const [selectedTestType, setSelectedTestType] = useState('');
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTestTypes();
  }, []);

  useEffect(() => {
    if (selectedTestType) {
      fetchResponses(selectedTestType);
    }
  }, [selectedTestType]);

  const fetchTestTypes = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'test_types'));
      const types = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTestTypes(types);
    } catch (error) {
      logger.error('Error fetching test types:', error);
      toast.error('Error al cargar tipos de prueba');
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (testType) => {
    try {
      let responsesData;
      
      if (testType === 'LT_QR') {
        // Para LT_QR incluir respuestas sin testType (legacy) y con testType
        const allSnapshot = await getDocs(collection(db, 'responses'));
        responsesData = allSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(response => !response.testType || response.testType === 'LT_QR');
      } else {
        // Para otros tipos, solo respuestas con testType específico
        const q = query(
          collection(db, 'responses'),
          where('testType', '==', testType)
        );
        const snapshot = await getDocs(q);
        responsesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }
      
      // Obtener respuestas modelo y configuración
      const answersQuery = query(
        collection(db, 'respuestas'),
        where('testType', '==', testType),
        where('active', '==', true)
      );
      const answersSnapshot = await getDocs(answersQuery);
      const modelAnswers = answersSnapshot.docs.map(doc => doc.data());
      
      // Obtener configuración de scoring
      let settings = {
        autoAnalysisWeight: 80,
        iaBackWeight: 20,
        iaFrontWeight: 10,
        maxIABackPenalty: 25,
        maxIAFrontPenalty: 5
      };
      
      try {
        const settingsDoc = await getDocs(query(collection(db, 'system_settings')));
        if (!settingsDoc.empty) {
          const settingsData = settingsDoc.docs[0].data();
          settings = { ...settings, ...settingsData };
        }
      } catch (error) {
        logger.log('Using default settings');
      }
      
      // Calcular puntaje y ordenar por ranking
      const rankedResponses = await Promise.all(
        responsesData.map(async response => ({
          ...response,
          totalScore: await calculateTotalScore(response, modelAnswers, settings),
          aiRiskLevel: calculateAIRiskLevel(response)
        }))
      );
      
      rankedResponses.sort((a, b) => b.totalScore - a.totalScore);
      setResponses(rankedResponses);
    } catch (error) {
      logger.error('Error fetching responses:', error);
      toast.error('Error al cargar respuestas');
    }
  };

  const calculateTotalScore = async (response, modelAnswers, settings) => {
    const totalQuestions = response.answers?.length || 0;
    if (totalQuestions === 0) return 0;
    
    // Obtener configuración por defecto si no se proporciona
    const config = settings || {
      autoAnalysisWeight: 80,
      iaBackWeight: 20,
      iaFrontWeight: 10,
      maxIABackPenalty: 25,
      maxIAFrontPenalty: 5
    };
    
    let autoAnalysisScore = 0;
    let iaBackScore = 0;
    let iaFrontScore = 0;
    
    // Calcular puntajes por cada respuesta
    for (let i = 0; i < totalQuestions; i++) {
      const userAnswer = response.answers[i] || '';
      const modelAnswer = modelAnswers.find(m => m.questionOrder === (i + 1));
      
      // Análisis automático (0-10)
      if (modelAnswer) {
        const userText = userAnswer.toLowerCase();
        const expectedText = modelAnswer.correctAnswer.toLowerCase();
        const keyPoints = modelAnswer.keyPoints || [];
        
        let questionScore = 0;
        
        // Criterio 1: Puntos clave (50% del puntaje total)
        let keyPointsFound = 0;
        keyPoints.forEach(point => {
          if (userText.includes(point.toLowerCase())) {
            keyPointsFound++;
          }
        });
        
        const keyPointsPercentage = keyPoints.length > 0 ? (keyPointsFound / keyPoints.length) : 0;
        questionScore += keyPointsPercentage * 5; // 50% del puntaje total (5/10)
        
        // Criterio 2: Similitud con respuesta esperada (50% restante)
        // Solo si tiene al menos 75% de puntos clave
        if (keyPointsPercentage >= 0.75) {
          const expectedWords = expectedText.split(' ').filter(word => word.length > 3);
          let similarWords = 0;
          
          expectedWords.forEach(word => {
            if (userText.includes(word)) {
              similarWords++;
            }
          });
          
          const textSimilarity = expectedWords.length > 0 ? (similarWords / expectedWords.length) : 0;
          
          // Si tiene alta similitud de texto (>=75%), obtiene el 50% restante
          if (textSimilarity >= 0.75) {
            questionScore += 5; // 50% restante (5/10)
          }
        }
        
        // No acumular aquí, se calcula por separado
      }
      
      // IA Back Score (invertido: menor = más humano)
      const backScore = calculateIABack(userAnswer);
      iaBackScore += (100 - backScore); // Invertir para que mayor = mejor
      
      // IA Front Score
      const frontScore = response.aiAnalysis?.serverResults?.[i]?.score || 0;
      iaFrontScore += (100 - frontScore); // Invertir para que mayor = mejor
    }
    
    // Promedios
    autoAnalysisScore = (autoAnalysisScore / totalQuestions) * 10; // Escalar a 100
    iaBackScore = iaBackScore / totalQuestions;
    iaFrontScore = iaFrontScore / totalQuestions;
    
    // Sistema proporcional: Cada pregunta aporta según su puntaje (0-10)
    let totalScore = 0;
    const pointsPerQuestion = 20 / totalQuestions; // 2.857 puntos por pregunta
    
    logger.log(`=== CÁLCULO PUNTAJE FINAL - ${response.name} (${response.dni}) ===`);
    logger.log(`Preguntas totales: ${totalQuestions}, Puntos por pregunta: ${pointsPerQuestion.toFixed(3)}`);
    
    for (let i = 0; i < totalQuestions; i++) {
      const userAnswer = response.answers[i] || '';
      const modelAnswer = modelAnswers.find(m => m.questionOrder === (i + 1));
      
      if (modelAnswer) {
        const questionScore = calculateQuestionScore(userAnswer, modelAnswer); // 0-10
        const questionPoints = (questionScore / 10) * pointsPerQuestion; // Proporcional
        totalScore += questionPoints;
        
        logger.log(`Pregunta ${i + 1}: ${questionScore}/10 = ${questionPoints.toFixed(2)} puntos`);
      }
    }
    
    logger.log(`PUNTAJE TOTAL: ${totalScore.toFixed(1)}/20`);
    logger.log('=== FIN CÁLCULO ===\n');
    
    return Math.round(totalScore * 10) / 10; // Redondear a 1 decimal
  };
  
  const calculateIABack = (answer) => {
    if (!answer || answer.length < 10) return 80;
    
    let humanScore = 50;
    const text = answer.toLowerCase();
    
    const humanIndicators = [
      /\b(creo|pienso|me parece|considero)\b/g,
      /\b(eh|um|bueno|entonces)\b/g,
      /[.]{2,}|\?{2,}|!{2,}/g,
      /\b(procentaje|porcentage|exito|exelente)\b/g,
      /\b(si falla|si funciona|creo que|tal vez)\b/g,
    ];
    
    humanIndicators.forEach(pattern => {
      const matches = (text.match(pattern) || []).length;
      humanScore += matches * 8;
    });
    
    const aiIndicators = [
      /^(en primer lugar|en segundo lugar|finalmente)/g,
      /\b(implementar|optimizar|eficiencia|escalabilidad)\b/g,
      /^[A-Z][^.!?]*[.!?]\s*[A-Z]/g,
      /\b(es importante destacar|cabe mencionar|es fundamental)\b/g,
    ];
    
    aiIndicators.forEach(pattern => {
      const matches = (text.match(pattern) || []).length;
      humanScore -= matches * 5;
    });
    
    if (answer.length > 200 && !text.includes('.')) humanScore -= 10;
    if (answer.split(' ').length > 50) humanScore -= 5;
    if (!/[.!?]$/.test(answer.trim())) humanScore += 5;
    if (/\b(a|de|en)\s+\b/.test(text)) humanScore += 3;
    if (text.includes('  ')) humanScore += 3;
    
    return Math.max(10, Math.min(95, humanScore));
  };
  
  const calculateQuestionScore = (answer, modelAnswer) => {
    return calculateAutoAnalysis(answer, modelAnswer);
  };
  
  const calculateQuestionScoreOld = (answer, modelAnswer) => {
    if (!answer || !modelAnswer) return 0;
    
    const userText = answer.toLowerCase();
    const expectedText = modelAnswer.correctAnswer.toLowerCase();
    const keyPoints = modelAnswer.keyPoints || [];
    
    let score = 0;
    
    // Criterio 1: Puntos clave (50% del puntaje total)
    let keyPointsFound = 0;
    
    // Sinónimos para puntos clave
    const synonyms = {
      'memoria': ['ligero', 'recursos', 'consume menos'],
      'cloud native': ['nube', 'enfocado para nube', 'cloud'],
      'rapido': ['cold start', 'velocidad', 'rápido', 'performance'],
      'asincrono': ['desacoplar', 'no afecte', 'independiente', 'paralelo'],
      'merchant id': ['codigo del comercio', 'comercio', 'merchant'],
      'checksum': ['validar', 'verificar', 'integridad'],
      'payload': ['datos', 'información', 'contenido'],
      'crc': ['validación', 'verificación']
    };
    
    keyPoints.forEach(point => {
      const pointLower = point.toLowerCase();
      let found = userText.includes(pointLower);
      
      // Si no se encuentra directamente, buscar sinónimos
      if (!found && synonyms[pointLower]) {
        found = synonyms[pointLower].some(synonym => userText.includes(synonym));
      }
      
      if (found) {
        keyPointsFound++;
      }
    });
    
    const keyPointsPercentage = keyPoints.length > 0 ? (keyPointsFound / keyPoints.length) : 0;
    
    // Sistema de puntos clave proporcional
    let keyPointsScore = keyPointsPercentage * 5; // 0-100% → 0-5 puntos
    
    score += keyPointsScore;
    
    // Criterio 2: Similitud con respuesta esperada (50% restante)
    if (keyPointsPercentage >= 0.25) {
      const expectedWords = expectedText.split(' ').filter(word => word.length > 2);
      let similarWords = 0;
      
      expectedWords.forEach(word => {
        if (userText.includes(word)) {
          similarWords++;
        }
      });
      
      // Buscar conceptos similares
      const conceptMatches = [
        { expected: ['tráfico', 'trafico'], user: ['distribucion', 'distribución'] },
        { expected: ['5-10%', 'porcentaje', 'mínimo'], user: ['minima', 'mínima', 'pequeño', 'poco'] },
        { expected: ['errores', 'error'], user: ['exito', 'éxito', 'transacional'] },
        { expected: ['latencia'], user: ['tiempo', 'respuesta', 'velocidad'] },
        { expected: ['monitoreo', 'métricas'], user: ['monitoreo', 'seguimiento', 'control'] },
        { expected: ['rollout', 'despliegue'], user: ['rollout', 'despliegue', 'implementación'] },
        { expected: ['memoria'], user: ['ligero', 'recursos', 'consume menos'] },
        { expected: ['cloud native'], user: ['nube', 'enfocado para nube', 'cloud'] },
        { expected: ['rapido'], user: ['cold start', 'velocidad', 'rápido', 'performance'] },
        { expected: ['asincrono'], user: ['desacoplar', 'no afecte', 'independiente', 'paralelo'] }
      ];
      
      conceptMatches.forEach(concept => {
        const hasExpected = concept.expected.some(word => expectedText.includes(word));
        const hasUser = concept.user.some(word => userText.includes(word));
        if (hasExpected && hasUser) {
          similarWords += 2;
        }
      });
      
      const textSimilarity = expectedWords.length > 0 ? (similarWords / expectedWords.length) : 0;
      
      if (textSimilarity >= 0.25) {
        score += 5;
      }
    }
    
    return Math.max(0, Math.min(10, score));
  };

  const calculateAIRiskLevel = (response) => {
    if (!response.aiAnalysis || !response.aiAnalysis.overallScore) return 'Bajo';
    
    const score = response.aiAnalysis.overallScore;
    if (score >= 7) return 'Alto';
    if (score >= 4) return 'Medio';
    return 'Bajo';
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'Alto': return 'text-red-600 bg-red-100';
      case 'Medio': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };
  
  const getScoreColor = (score) => {
    if (score >= 15) return 'text-green-600 bg-green-100';
    if (score >= 11) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const downloadCSV = async () => {
    if (responses.length === 0) {
      toast.error('No hay datos para descargar');
      return;
    }

    // Obtener preguntas para las cabeceras
    let questionHeaders = [];
    try {
      const q = query(
        collection(db, 'questions'),
        where('testType', '==', selectedTestType),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      const questions = snapshot.docs.map(doc => doc.data()).sort((a, b) => a.order - b.order);
      questionHeaders = questions.map(q => q.questionText.replace(/[\|\r\n]/g, ' ').trim());
    } catch (error) {
      questionHeaders = responses[0].answers?.map((_, index) => `Pregunta ${index + 1}`) || [];
    }

    const headers = [
      'Ranking',
      'DNI',
      'Nombre',
      'Fecha Envío',
      'Puntaje Total',
      ...questionHeaders
    ];

    const csvData = responses.map((response, index) => [
      index + 1,
      response.dni,
      response.name,
      new Date(response.submittedAt?.seconds * 1000).toLocaleDateString(),
      response.totalScore,
      ...response.answers?.map(answer => answer.replace(/[\|\r\n]/g, ' ').trim()) || []
    ]);

    const csvContent = [
      headers.join('|'),
      ...csvData.map(row => row.join('|'))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${selectedTestType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Reporte descargado exitosamente');
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
        <h1 className="text-2xl font-bold text-gray-900">Reportes de Pruebas</h1>
        <p className="text-gray-600">Análisis y ranking de postulantes por tipo de prueba</p>
      </div>

      {/* Selector de tipo de prueba */}
      <div className="mb-6 flex justify-between items-center">
        <select
          value={selectedTestType}
          onChange={(e) => setSelectedTestType(e.target.value)}
          className="form-input"
        >
          <option value="">Seleccionar tipo de prueba</option>
          {testTypes.map(type => (
            <option key={type.code} value={type.code}>
              {type.name}
            </option>
          ))}
        </select>

        {selectedTestType && responses.length > 0 && (
          <button
            onClick={() => downloadCSV()}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Download size={16} />
            <span>Descargar CSV</span>
          </button>
        )}
      </div>

      {/* Estadísticas generales */}
      {selectedTestType && responses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-900">Total Postulantes</h3>
            <p className="text-2xl font-bold text-blue-600">{responses.length}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-900">Puntaje Promedio</h3>
            <p className="text-2xl font-bold text-green-600">
              {responses.length > 0 ? `${(responses.reduce((sum, r) => sum + r.totalScore, 0) / responses.length).toFixed(1)}/20` : '0/20'}
            </p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-900">Riesgo Alto IA</h3>
            <p className="text-2xl font-bold text-red-600">
              {responses.filter(r => r.aiRiskLevel === 'Alto').length}
            </p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-900">Mejor Puntaje</h3>
            <p className="text-2xl font-bold text-purple-600">
              {responses.length > 0 ? `${responses[0].totalScore}/20` : '0/20'}
            </p>
          </div>
        </div>
      )}

      {/* Ranking de postulantes */}
      {selectedTestType && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ranking de Postulantes
          </h2>
          
          {responses.length === 0 ? (
            <div className="text-center py-8">
              <User size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No hay respuestas para este tipo de prueba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map((response, index) => (
                <div 
                  key={response.id} 
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/applicants/${response.dni}`)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                      {index < 3 ? (
                        <Trophy size={16} className={
                          index === 0 ? 'text-yellow-600' :
                          index === 1 ? 'text-gray-600' : 'text-orange-600'
                        } />
                      ) : (
                        <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900">{response.name}</h3>
                      <p className="text-sm text-gray-500">DNI: {response.dni}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-sm font-semibold ${getScoreColor(response.totalScore)}`}>
                        {response.totalScore}/20
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(response.submittedAt?.seconds * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(response.aiRiskLevel)}`}>
                        {response.aiRiskLevel === 'Alto' && <AlertTriangle size={12} className="inline mr-1" />}
                        IA: {response.aiRiskLevel}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;