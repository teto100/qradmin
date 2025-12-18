import { calculateAutoAnalysis } from '../services/scoringService';

// Calcular score total del examen (0-20 puntos)
export const calculateExamScore = (applicantData, modelAnswers) => {
  console.log('🔍 Iniciando cálculo de score del examen');
  console.log('📝 ApplicantData:', applicantData);
  console.log('📋 ModelAnswers count:', modelAnswers?.length || 0);
  
  if (!applicantData.answers || applicantData.answers.length === 0) {
    console.log('❌ No hay respuestas');
    return 0;
  }
  
  let totalScore = 0;
  const totalQuestions = applicantData.answers.length;
  const pointsPerQuestion = 20 / totalQuestions;
  
  console.log('📊 Total preguntas:', totalQuestions);
  console.log('📊 Puntos por pregunta:', pointsPerQuestion);
  
  applicantData.answers.forEach((answer, index) => {
    const modelAnswer = modelAnswers.find(m => m.questionOrder === (index + 1));
    console.log(`📝 Pregunta ${index + 1}:`, { answer: answer?.substring(0, 50), modelAnswer: !!modelAnswer });
    
    if (modelAnswer) {
      const questionScore = calculateAutoAnalysis(answer, modelAnswer); // 0-10
      const questionPoints = (questionScore / 10) * pointsPerQuestion;
      totalScore += questionPoints;
      console.log(`🏆 Pregunta ${index + 1} - Score: ${questionScore}/10, Puntos: ${questionPoints}`);
    } else {
      console.log(`❌ Pregunta ${index + 1} - Sin modelo`);
    }
  });
  
  const finalScore = Math.round(totalScore * 10) / 10;
  console.log('🏆 Score final:', finalScore);
  return finalScore;
};

// Calcular nivel de riesgo IA
export const calculateAIRiskLevel = (applicantData) => {
  if (!applicantData.aiAnalysis || !applicantData.aiAnalysis.overallScore) return 'Bajo';
  
  const score = applicantData.aiAnalysis.overallScore;
  if (score >= 7) return 'Alto';
  if (score >= 4) return 'Medio';
  return 'Bajo';
};