// Análisis de métricas de texto
export const analyzeTextMetrics = (text) => {
  const words = text.trim().split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  
  return {
    wordCount: words.length,
    charCount: text.length,
    avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length,
    sentenceCount: sentences.length,
    avgSentenceLength: words.length / sentences.length
  };
};

// Análisis temporal
export const analyzeTimingPatterns = (timeSpent, wordCount) => {
  const wordsPerMinute = (wordCount / timeSpent) * 60;
  
  // Humanos típicamente escriben 40-60 wpm
  // IA puede "escribir" 200+ wpm
  if (wordsPerMinute > 150) return 80; // Muy sospechoso
  if (wordsPerMinute > 100) return 60; // Sospechoso
  if (wordsPerMinute > 70) return 40;  // Rápido pero posible
  return 20; // Normal
};

// Detectar patrones de IA
export const detectPatterns = (text) => {
  const indicators = [];
  
  // Conectores formales excesivos
  const formalConnectors = [
    'furthermore', 'moreover', 'additionally',
    'consequently', 'therefore', 'thus'
  ];
  const connectorCount = formalConnectors.filter(c => 
    text.toLowerCase().includes(c)
  ).length;
  if (connectorCount > 2) indicators.push('excessive_formal_connectors');
  
  // Estructura de lista
  if (/\d+\.\s/.test(text) || /•/.test(text)) {
    indicators.push('list_structure');
  }
  
  // Ausencia de contracciones
  const contractions = ["don't", "can't", "won't", "I'm", "it's"];
  const hasContractions = contractions.some(c => 
    text.toLowerCase().includes(c)
  );
  if (!hasContractions && text.length > 100) {
    indicators.push('no_contractions');
  }
  
  // Vocabulario muy técnico
  const technicalWords = text.match(/\b[a-z]{10,}\b/gi) || [];
  if (technicalWords.length > text.split(/\s+/).length * 0.15) {
    indicators.push('excessive_technical_vocabulary');
  }
  
  return indicators;
};