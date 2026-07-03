import React from 'react';

export default function ScoreBadge({ score, explanation, computedBy, size = 'md' }) {
  if (score === null || score === undefined) return null;

  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : score >= 40 ? '#ea580c' : '#dc2626';
  const label = score >= 80 ? 'Great Match' : score >= 60 ? 'Good Match' : score >= 40 ? 'Fair Match' : 'Low Match';

  const sizeClass = size === 'lg' ? 'score-badge-lg' : 'score-badge-md';

  return (
    <div className={`score-badge ${sizeClass}`} title={explanation || ''}>
      <div className="score-circle" style={{ borderColor: color, color }}>
        <span className="score-number">{score}</span>
        <span className="score-max">/100</span>
      </div>
      <div className="score-info">
        <span className="score-label" style={{ color }}>{label}</span>
        {computedBy === 'rule_based' && (
          <span className="score-method" title="Computed by rule-based fallback">⚙ Rule-based</span>
        )}
        {computedBy === 'llm' && (
          <span className="score-method" title="Computed by AI">✦ AI Score</span>
        )}
      </div>
    </div>
  );
}
