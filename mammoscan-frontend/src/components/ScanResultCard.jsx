import React from 'react';
import { Activity, Calendar, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

const ScanResultCard = ({ scan }) => {
  if (!scan) return null;

  const getBiradsColor = (result) => {
    if (result?.includes('Category 1') || result?.includes('Category 2')) return 'text-green-500 bg-green-50';
    if (result?.includes('Category 3')) return 'text-yellow-500 bg-yellow-50';
    if (result?.includes('Category 4')) return 'text-orange-500 bg-orange-50';
    if (result?.includes('Category 5')) return 'text-red-500 bg-red-50';
    return 'text-gray-500 bg-gray-50';
  };

  const getBiradsInterpretation = (result) => {
    if (result?.includes('Category 1')) return 'Négatif - Examen normal';
    if (result?.includes('Category 2')) return 'Découverte bénigne - Rassurant';
    if (result?.includes('Category 3')) return 'Probablement bénin - Surveillance recommandée';
    if (result?.includes('Category 4')) return 'Suspicion - Biopsie recommandée';
    if (result?.includes('Category 5')) return 'Hautement suggestif de malignité - Intervention urgente';
    return 'Non classifié';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-2 shadow-sm hover:shadow-md transition-shadow">
      <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
          <Activity className="w-3 h-3 text-blue-500" />
        </div>
        Résultat de Mammographie
      </h4>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center text-sm">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <span className="text-gray-600">Date de l'examen</span>
          </div>
          <span className="font-mono text-sm text-gray-800">{scan.date}</span>
        </div>
        
        <div className="pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center text-sm">
              <TrendingUp className="w-4 h-4 mr-2 text-gray-400" />
              <span className="text-gray-600">Classification BI-RADS</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBiradsColor(scan.birads_result)}`}>
              {scan.birads_result}
            </span>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            {getBiradsInterpretation(scan.birads_result)}
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm">
            {scan.tumor_detected ? (
              <AlertCircle className="w-4 h-4 mr-2 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            )}
            <span className="text-gray-600">Détection de tumeur</span>
          </div>
          <span className={`font-medium ${scan.tumor_detected ? 'text-red-500' : 'text-green-500'}`}>
            {scan.tumor_detected ? 'Détectée' : 'Non détectée'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScanResultCard;