import { analyzeTextMetrics, analyzeTimingPatterns, detectPatterns } from '../utils/textAnalysis';

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
    
    // 4. Para desarrollo, simulamos análisis de IA
    // En producción, esto debería llamar a Cloud Functions
    const mockAIAnalysis = {
      score: Math.min(50 + Math.random() * 40, 100), // Score aleatorio para demo
      confidence: 'medium',
      indicators: ['mock_analysis'],
      reasoning: 'Análisis simulado para desarrollo'
    };
    
    // 5. Calcular score final
    const finalScore = calculateFinalScore({
      temporal: temporalScore,
      patterns: patternScore,
      ai: mockAIAnalysis.score
    });
    
    return {
      score: Math.min(finalScore, 100),
      confidence: mockAIAnalysis.confidence,
      indicators: [
        ...patternIndicators,
        ...mockAIAnalysis.indicators
      ],
      reasoning: mockAIAnalysis.reasoning,
      metadata: textMetrics
    };
  } catch (error) {
    console.error('Error en análisis:', error);
    return {
      score: 50,
      confidence: 'low',
      indicators: ['analysis_failed'],
      reasoning: 'No se pudo completar el análisis',
      metadata: analyzeTextMetrics(response.answer)
    };
  }
};