// Servicio centralizado para cálculo de scores
export const calculateAutoAnalysis = (answer, modelAnswer) => {
  if (!answer || !modelAnswer) return 0;
  
  const userText = answer.toLowerCase();
  const expectedText = modelAnswer.correctAnswer.toLowerCase();
  const keyPoints = modelAnswer.keyPoints || [];
  
  let score = 0;
  
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
  
  // Criterio 1: Puntos clave (50% del puntaje total)
  let keyPointsFound = 0;
  
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
  let similarityScore = 0;
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
      similarityScore = 5;
    }
  }
  
  score += similarityScore;
  
  return Math.round(Math.max(0, Math.min(10, score)));
};