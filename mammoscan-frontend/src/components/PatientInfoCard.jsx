import React from 'react';
import { User, Calendar, Venus, Activity, FileText, Heart } from 'lucide-react';

const PatientInfoCard = ({ patient }) => {
  if (!patient) return null;

  const getRiskColor = (score) => {
    if (score > 0.7) return 'text-red-500 bg-red-50';
    if (score > 0.3) return 'text-orange-500 bg-orange-50';
    return 'text-green-500 bg-green-50';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-2 shadow-sm hover:shadow-md transition-shadow">
      <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
        <div className="w-6 h-6 bg-pink-100 rounded-full flex items-center justify-center mr-2">
          <User className="w-3 h-3 text-pink-500" />
        </div>
        Informations Patient
      </h4>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center text-sm">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <span className="text-gray-600">ID Patient</span>
          </div>
          <span className="font-mono font-medium text-gray-800">{patient.patient_id}</span>
        </div>
        
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center text-sm">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <span className="text-gray-600">Âge</span>
          </div>
          <span className="font-medium text-gray-800">{patient.age} ans</span>
        </div>
        
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center text-sm">
            <Venus className="w-4 h-4 mr-2 text-gray-400" />
            <span className="text-gray-600">Genre</span>
          </div>
          <span className="font-medium text-gray-800">{patient.gender}</span>
        </div>
        
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center text-sm">
            <Activity className="w-4 h-4 mr-2 text-gray-400" />
            <span className="text-gray-600">Score de Risque</span>
          </div>
          <div className={`px-2 py-1 rounded-full text-sm font-medium ${getRiskColor(patient.risk_score)}`}>
            {(patient.risk_score * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="pt-2">
          <div className="flex items-start text-sm mb-2">
            <FileText className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
            <span className="text-gray-600">Antécédents</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {patient.history?.map((item, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientInfoCard;