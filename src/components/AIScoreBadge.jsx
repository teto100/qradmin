const AIScoreBadge = ({ score, label, isAutoAnalysis }) => {
  
  const getBadgeClass = () => {
    if (isAutoAnalysis) {
      if (score >= 8) return 'badge badge-green';
      if (score >= 6) return 'badge badge-yellow';
      return 'badge badge-red';
    }
    if (label === 'IA Back') {
      if (score <= 30) return 'badge badge-green';
      if (score <= 70) return 'badge badge-yellow';
      return 'badge badge-red';
    }
    if (score <= 30) return 'badge badge-green';
    if (score <= 60) return 'badge badge-yellow';
    return 'badge badge-red';
  };
  
  const getLabel = () => {
    if (isAutoAnalysis) {
      return `${score}/10`;
    }
    return `${score}%`;
  };
  
  return (
    <span className={getBadgeClass()}>
      {getLabel()}
    </span>
  );
};

export default AIScoreBadge;