import { analyzeTextMetrics, analyzeTimingPatterns, detectPatterns } from '../utils/textAnalysis';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

// Score final ponderado
const calculateFinalScore = ({ temporal, patterns, ai }) => {
  return Math.round(
    temporal * 0.2 +
    patterns * 0.3 +
    ai * 0.5
  );
};

// Análisis completo de respuesta
export const analyzeResponse = async (response, question) => {
  try {
    // 1. Análisis de texto básico
    const textMetrics = analyzeTextMetrics(response.answer);
    
    // 2. Análisis temporal
    const temporalScore = analyzeTimingPatterns(
      response.timeSpent,
      textMetrics.wordCount
    );
    
    // 3. Análisis de patrones
    const patternIndicators = detectPatterns(response.answer);
    const patternScore = patternIndicators.length * 20; // Score basado en indicadores
    
    // 4. Buscar respuesta modelo en Firebase
    let modelAnswer = null;
    try {
      const answersQuery = query(
        collection(db, 'respuestas'),
        where('questionOrder', '==', response.questionNumber || 1),
        where('active', '==', true)
      );
      const answersSnapshot = await getDocs(answersQuery);
      
      if (!answersSnapshot.empty) {
        modelAnswer = answersSnapshot.docs[0].data();
      }
    } catch (error) {
      // Continuar sin respuesta modelo
    }
    
    // 5. Análisis comparativo con respuesta modelo
    let aiScore = 50; // Score por defecto
    let reasoning = 'Análisis básico sin respuesta modelo';
    
    if (modelAnswer) {
      const userAnswer = response.answer.toLowerCase();
      const keyPoints = modelAnswer.keyPoints || [];
      
      // Contar puntos clave mencionados
      const foundPoints = keyPoints.filter(point => 
        userAnswer.includes(point.toLowerCase())
      );
      
      // Calcular score basado en cobertura
      const coverage = keyPoints.length > 0 ? foundPoints.length / keyPoints.length : 0;
      aiScore = Math.round(coverage * 100);
      
      reasoning = `Cobertura: ${foundPoints.length}/${keyPoints.length} puntos clave encontrados`;
    }
    
    const aiAnalysis = {
      score: aiScore,
      confidence: modelAnswer ? 'high' : 'low',
      indicators: modelAnswer ? [`coverage: ${aiScore}%`] : ['no_model_answer'],
      reasoning,
      modelAnswer
    };
    
    // 6. Calcular score final
    const finalScore = calculateFinalScore({
      temporal: temporalScore,
      patterns: patternScore,
      ai: aiAnalysis.score
    });
    
    return {
      score: Math.min(finalScore, 100),
      confidence: aiAnalysis.confidence,
      indicators: [
        ...patternIndicators,
        ...aiAnalysis.indicators
      ],
      reasoning: aiAnalysis.reasoning,
      metadata: textMetrics,
      modelComparison: aiAnalysis.modelAnswer
    };
  } catch (error) {
    // Error en análisis - silenciado en producción
    return {
      score: 50,
      confidence: 'low',
      indicators: ['analysis_failed'],
      reasoning: 'No se pudo completar el análisis',
      metadata: analyzeTextMetrics(response.answer)
    };
  }
};