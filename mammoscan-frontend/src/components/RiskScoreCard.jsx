import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Shield } from 'lucide-react';

const RiskScoreCard = ({ score }) => {
  const percentage = score * 100;
  
  const getRiskLevel = () => {
    if (score > 0.7) return { 
      text: 'Risque Élevé', 
      color: 'text-red-600', 
      bg: 'bg-red-100',
      border: 'border-red-200',
      icon: AlertCircle,
      recommendation: 'Consultation spécialisée urgente recommandée'
    };
    if (score > 0.3) return { 
      text: 'Risque Modéré', 
      color: 'text-orange-600', 
      bg: 'bg-orange-100',
      border: 'border-orange-200',
      icon: AlertCircle,
      recommendation: 'Surveillance régulière et mammographie annuelle'
    };
    return { 
      text: 'Risque Faible', 
      color: 'text-green-600', 
      bg: 'bg-green-100',
      border: 'border-green-200',
      icon: CheckCircle,
      recommendation: 'Maintenir les contrôles de routine'
    };
  };

  const riskLevel = getRiskLevel();
  const RiskIcon = riskLevel.icon;

  return (
    <div className={`bg-white border ${riskLevel.border} rounded-xl p-4 mt-2 shadow-sm`}>
      <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-2">
          <Shield className="w-3 h-3 text-purple-500" />
        </div>
        Évaluation du Risque par IA
      </h4>

      <div className="text-center mb-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${riskLevel.bg} ${riskLevel.color} text-sm font-medium mb-3`}>
          <RiskIcon className="w-4 h-4" />
          {riskLevel.text}
        </div>
        
        <div className="relative">
          <div className="text-5xl font-bold text-gray-800 mb-2">
            {percentage.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Score de prédiction</div>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-700 ease-out ${
            score > 0.7 ? 'bg-gradient-to-r from-red-400 to-red-600' : 
            score > 0.3 ? 'bg-gradient-to-r from-orange-400 to-orange-600' : 
            'bg-gradient-to-r from-green-400 to-green-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Recommandation</p>
            <p className="text-xs text-gray-600">{riskLevel.recommendation}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400 text-center">
        Prédiction basée sur l'analyse des données historiques
      </div>
    </div>
  );
};

export default RiskScoreCard;