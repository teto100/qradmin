import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ArrowLeft, User, Calendar, Clock, AlertTriangle, LogIn } from 'lucide-react';
import AIScoreBadge from '../components/AIScoreBadge';

const ApplicantDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [applicant, setApplicant] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [modelAnswers, setModelAnswers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplicant = async () => {
      try {
        const docRef = doc(db, 'responses', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const applicantData = {
            id: docSnap.id,
            name: data.name || 'Sin nombre',
            dni: data.dni || 'Sin DNI',
            submittedAt: data.submittedAt,
            completionTime: data.completionTime,
            answers: data.answers || [],
            aiAnalysis: data.aiAnalysis || {},
            timeExpired: data.timeExpired || false
          };
          setApplicant(applicantData);
          
          // Obtener intentos de acceso
          if (data.dni) {
            const attemptsRef = collection(db, 'attempts');
            const attemptsQuery = query(attemptsRef, where('dni', '==', data.dni));
            const attemptsSnapshot = await getDocs(attemptsQuery);
            
            const attemptsData = attemptsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })).sort((a, b) => b.timestamp?.toDate?.() - a.timestamp?.toDate?.());
            
            setAttempts(attemptsData);
          }
          
          // Obtener respuestas modelo y preguntas
          const testType = data.testType || 'LT_QR';
          
          const answersQuery = query(
            collection(db, 'respuestas'),
            where('testType', '==', testType),
            where('active', '==', true)
          );
          const answersSnapshot = await getDocs(answersQuery);
          const answersData = answersSnapshot.docs.map(doc => doc.data())
            .sort((a, b) => a.questionOrder - b.questionOrder);
          
          const questionsQuery = query(
            collection(db, 'questions'),
            where('testType', '==', testType),
            where('active', '==', true)
          );
          const questionsSnapshot = await getDocs(questionsQuery);
          const questionsData = questionsSnapshot.docs.map(doc => doc.data())
            .sort((a, b) => a.order - b.order);
          
          setModelAnswers(answersData);
          setQuestions(questionsData);
        }
      } catch (error) {
        console.error('Error fetching applicant:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicant();
  }, [id]);

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

  if (!applicant) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Postulante no encontrado</h1>
          <button
            onClick={() => navigate('/applicants')}
            className="btn btn-primary"
          >
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  const getRiskBadge = (riskLevel) => {
    const riskMap = {
      low: { class: 'badge badge-green', label: 'Bajo Riesgo' },
      moderate: { class: 'badge badge-yellow', label: 'Riesgo Moderado' },
      high: { class: 'badge badge-red', label: 'Alto Riesgo' },
      critical: { class: 'badge badge-red', label: 'Crítico' }
    };
    
    const riskInfo = riskMap[riskLevel] || { class: 'badge', label: riskLevel || 'Sin evaluar' };
    return <span className={riskInfo.class}>{riskInfo.label}</span>;
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const calculateIABack = (answer) => {
    if (!answer || answer.length < 10) return 20;
    
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

  const calculateAutoAnalysis = (answer, modelAnswer) => {
    if (!answer || !modelAnswer) return 0;
    
    const userText = answer.toLowerCase();
    const expectedText = modelAnswer.correctAnswer.toLowerCase();
    const keyPoints = modelAnswer.keyPoints || [];
    

    
    let score = 0;
    
    // Criterio 1: Puntos clave (50% del puntaje total)
    let keyPointsFound = 0;
    keyPoints.forEach(point => {
      const found = userText.includes(point.toLowerCase());
      if (found) {
        keyPointsFound++;
      }
    });
    
    const keyPointsPercentage = keyPoints.length > 0 ? (keyPointsFound / keyPoints.length) : 0;
    
    // Nuevo sistema de puntos clave
    let keyPointsScore = 0;
    if (keyPointsPercentage === 1.0) {
      keyPointsScore = 5; // 100% puntos clave = 50% respuesta (5/10)
    } else if (keyPointsPercentage >= 0.5) {
      keyPointsScore = 2.5; // ≥50% puntos clave = 25% respuesta (2.5/10)
    } else if (keyPointsPercentage > 0) {
      keyPointsScore = 1.5; // <50% pero >0% = 15% respuesta (1.5/10)
    } else {
      keyPointsScore = 0; // 0% puntos clave = 0% respuesta (0/10)
    }
    
    score += keyPointsScore;
    

    
    // Criterio 2: Similitud con respuesta esperada (50% restante)
    if (keyPointsPercentage >= 0.25) {
      const expectedWords = expectedText.split(' ').filter(word => word.length > 3);
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
        { expected: ['rollout', 'despliegue'], user: ['rollout', 'despliegue', 'implementación'] }
      ];
      
      let conceptBonus = 0;
      conceptMatches.forEach(concept => {
        const hasExpected = concept.expected.some(word => expectedText.includes(word));
        const hasUser = concept.user.some(word => userText.includes(word));
        if (hasExpected && hasUser) {
          similarWords += 2;
          conceptBonus += 2;
        }
      });
      
      const textSimilarity = expectedWords.length > 0 ? (similarWords / expectedWords.length) : 0;
      
      if (textSimilarity >= 0.25) {
        score += 5;
      }
    }
    
    const finalScore = Math.round(Math.max(0, Math.min(10, score)));
    
    return finalScore;
  };

  // Calcular score combinado IA Front + Back
  const calculateCombinedScore = () => {
    if (!applicant.answers || applicant.answers.length === 0) return { front: 0, back: 0, combined: 0 };
    
    let frontTotal = 0;
    let backTotal = 0;
    let validAnswers = 0;
    
    applicant.answers.forEach((answer, index) => {
      const serverResult = applicant.aiAnalysis?.serverResults?.[index];
      const frontScore = serverResult?.score || 0;
      const backScore = calculateIABack(answer);
      
      frontTotal += frontScore;
      backTotal += backScore;
      validAnswers++;
    });
    
    const frontAvg = validAnswers > 0 ? Math.round(frontTotal / validAnswers) : 0;
    const backAvg = validAnswers > 0 ? Math.round(backTotal / validAnswers) : 0;
    const combinedAvg = Math.round((frontAvg + backAvg) / 2);
    
    return { front: frontAvg, back: backAvg, combined: combinedAvg };
  };
  
  const scores = calculateCombinedScore();
  const overallScore = scores.combined;
  
  // Calcular nivel de riesgo basado en score combinado
  const calculateRiskLevel = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'moderate';
    return 'low';
  };
  
  const calculatedRiskLevel = calculateRiskLevel(overallScore);
  const finalRiskLevel = applicant.aiAnalysis?.finalAssessment?.riskLevel || calculatedRiskLevel;

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/applicants')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          <span>Volver a postulantes</span>
        </button>
        
        <h1 className="text-2xl font-bold text-gray-900">Detalle del Postulante</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Información Personal */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User size={20} style={{ marginRight: '0.5rem' }} />
            Información Personal
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500">Nombre:</span>
              <p className="text-gray-900">{applicant.name}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">DNI:</span>
              <p className="text-gray-900">{applicant.dni}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Fecha de prueba:</span>
              <p className="text-gray-900">
                {applicant.submittedAt?.toDate?.()?.toLocaleString() || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Información de la Prueba */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock size={20} style={{ marginRight: '0.5rem' }} />
            Información de la Prueba
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500">Tiempo utilizado:</span>
              <p className="text-gray-900">{formatTime(applicant.completionTime || 0)}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">¿Tiempo expirado?:</span>
              <p className="text-gray-900">{applicant.timeExpired ? 'Sí' : 'No'}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Respuestas completadas:</span>
              <p className="text-gray-900">{applicant.answers.length} de 7</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Intentos de acceso:</span>
              <p className="text-gray-900">{attempts.length} veces</p>
            </div>
          </div>
        </div>
      </div>

      {/* Análisis de IA */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <AlertTriangle size={20} style={{ marginRight: '0.5rem' }} />
          Análisis de IA
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">IA Front</p>
            <AIScoreBadge score={scores.front} label="IA Front" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">IA Back</p>
            <AIScoreBadge score={scores.back} label="IA Back" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">Score Promedio</p>
            <AIScoreBadge score={overallScore} label="Promedio" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">Nivel de Riesgo</p>
            {getRiskBadge(finalRiskLevel)}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">Respuestas Sospechosas</p>
            <p className="text-lg font-semibold text-gray-900">
              {applicant.aiAnalysis?.highRiskAnswers || 0}
            </p>
          </div>
        </div>

        {applicant.aiAnalysis?.finalAssessment?.description && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Evaluación:</h3>
            <p className="text-gray-700">{applicant.aiAnalysis.finalAssessment.description}</p>
            {applicant.aiAnalysis.finalAssessment.recommendation && (
              <div className="mt-2">
                <span className="font-medium text-gray-900">Recomendación: </span>
                <span className="text-gray-700">{applicant.aiAnalysis.finalAssessment.recommendation}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historial de Accesos */}
      {attempts.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <LogIn size={20} style={{ marginRight: '0.5rem' }} />
            Historial de Accesos ({attempts.length})
          </h2>
          
          <div className="space-y-2">
            {attempts.slice(0, 10).map((attempt, index) => (
              <div key={attempt.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {attempt.timestamp?.toDate?.()?.toLocaleString() || 'Fecha no disponible'}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    IP: {attempt.ip || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    attempt.success 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {attempt.success ? 'Exitoso' : 'Fallido'}
                  </span>
                  {attempt.failureReason && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({attempt.failureReason})
                    </span>
                  )}
                </div>
              </div>
            ))}
            {attempts.length > 10 && (
              <p className="text-sm text-gray-500 text-center mt-2">
                Mostrando los 10 más recientes de {attempts.length} intentos
              </p>
            )}
          </div>
        </div>
      )}

      {/* Respuestas */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Respuestas ({applicant.answers.length})
        </h2>
        
        <div className="space-y-4">
          {applicant.answers.map((answer, index) => {
            const serverResult = applicant.aiAnalysis?.serverResults?.[index];
            const modelAnswer = modelAnswers.find(m => m.questionOrder === (index + 1));
            const question = questions.find(q => q.order === (index + 1));
            
            return (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">Pregunta {index + 1}</h3>
                    {question && (
                      <p className="text-sm text-gray-600 italic">{question.questionText}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {serverResult && (
                      <AIScoreBadge score={serverResult.score || 0} label="IA Front" />
                    )}
                    <AIScoreBadge score={calculateIABack(answer)} label="IA Back" />
                    <AIScoreBadge score={calculateAutoAnalysis(answer, modelAnswer)} label="Análisis Automático" isAutoAnalysis={true} />
                  </div>
                </div>
                
                {/* Respuesta del postulante */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Respuesta del postulante:</h4>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">{answer}</p>
                </div>
                
                {/* Respuesta esperada */}
                {modelAnswer && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-green-700 mb-2">Respuesta esperada:</h4>
                    <div className="bg-green-50 border border-green-200 p-3 rounded">
                      <p className="text-green-800 whitespace-pre-wrap mb-2">{modelAnswer.correctAnswer}</p>
                      {modelAnswer.keyPoints && modelAnswer.keyPoints.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-green-700 mb-1">Puntos clave:</p>
                          <ul className="text-xs text-green-600 list-disc list-inside">
                            {modelAnswer.keyPoints.map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {modelAnswer.scoringCriteria?.excellent && (
                        <div>
                          <p className="text-xs font-medium text-green-700 mb-1">Criterio excelente:</p>
                          <p className="text-xs text-green-600">{modelAnswer.scoringCriteria.excellent}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {serverResult?.findings && serverResult.findings.length > 0 && (
                  <div className="mt-2">
                    <span className="text-sm font-medium text-gray-500">Indicadores IA: </span>
                    <span className="text-sm text-gray-600">{serverResult.findings.join(', ')}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ApplicantDetailPage;