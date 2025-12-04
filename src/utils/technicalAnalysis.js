// Análisis técnico de respuestas
export const analyzeTechnicalResponse = (answer, expectedKeywords = [], expectedConcepts = []) => {
  const normalizedAnswer = answer.toLowerCase();
  
  // Contar palabras clave encontradas
  const foundKeywords = expectedKeywords.filter(keyword => 
    normalizedAnswer.includes(keyword.toLowerCase())
  );
  
  // Contar conceptos técnicos mencionados
  const foundConcepts = expectedConcepts.filter(concept =>
    normalizedAnswer.includes(concept.toLowerCase())
  );
  
  // Calcular score basado en cobertura
  const keywordScore = (foundKeywords.length / expectedKeywords.length) * 50;
  const conceptScore = (foundConcepts.length / expectedConcepts.length) * 50;
  
  const totalScore = Math.min(keywordScore + conceptScore, 100);
  
  // Determinar nivel de respuesta
  let level = 'poor';
  if (totalScore >= 80) level = 'excellent';
  else if (totalScore >= 60) level = 'good';
  else if (totalScore >= 40) level = 'fair';
  
  return {
    score: Math.round(totalScore),
    level,
    foundKeywords,
    foundConcepts,
    missingKeywords: expectedKeywords.filter(k => !foundKeywords.includes(k)),
    missingConcepts: expectedConcepts.filter(c => !foundConcepts.includes(c)),
    coverage: {
      keywords: foundKeywords.length / expectedKeywords.length,
      concepts: foundConcepts.length / expectedConcepts.length
    }
  };
};

// Preguntas técnicas predefinidas con sus criterios
export const technicalQuestions = {
  'aws_messaging': {
    keywords: ['sns', 'sqs', 'asincrono', 'evento'],
    concepts: ['fan-out', 'desacoplamiento', 'patron abanico', 'distribuir', 'garantizar procesamiento']
  },
  'mvc_pattern': {
    keywords: ['model', 'view', 'controller', 'mvc'],
    concepts: ['separacion responsabilidades', 'mantenimiento', 'testabilidad', 'reutilizacion']
  },
  'database_optimization': {
    keywords: ['indice', 'query', 'optimizacion', 'performance'],
    concepts: ['explain plan', 'cache', 'normalizacion', 'particionado']
  }
};

// Detectar tipo de pregunta automáticamente
export const detectQuestionType = (questionText) => {
  const normalized = questionText.toLowerCase();
  
  if (normalized.includes('sns') || normalized.includes('sqs') || normalized.includes('messaging')) {
    return 'aws_messaging';
  }
  if (normalized.includes('mvc') || normalized.includes('patron')) {
    return 'mvc_pattern';
  }
  if (normalized.includes('sql') || normalized.includes('base de datos') || normalized.includes('optimizar')) {
    return 'database_optimization';
  }
  
  return null;
};