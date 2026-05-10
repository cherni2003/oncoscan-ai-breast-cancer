import React from 'react';
import { Users, AlertTriangle, TrendingUp, Calendar, Activity, Heart } from 'lucide-react';

const DashboardStats = ({ stats }) => {
  if (!stats) return null;

  const cancerRate = (stats.cancer_cases / stats.total_patients) * 100;
  const lastUpdated = new Date(stats.last_updated);

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <StatCard
          title="Total Patients"
          value={stats.total_patients}
          icon={Users}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          subtitle="Enregistrés dans le système"
        />
        
        <StatCard
          title="Cas Cancéreux"
          value={stats.cancer_cases}
          icon={AlertTriangle}
          color="bg-gradient-to-br from-red-500 to-red-600"
          subtitle={`${cancerRate.toFixed(1)}% des patients`}
        />
        
        <StatCard
          title="Risque Moyen"
          value={`${(stats.average_risk * 100).toFixed(1)}%`}
          icon={Activity}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
          subtitle="Score de risque global"
        />
        
        <StatCard
          title="Taux d'Incidence"
          value={`${cancerRate.toFixed(1)}%`}
          icon={Heart}
          color="bg-gradient-to-br from-pink-500 to-pink-600"
          subtitle="Proportion de cas"
        />
      </div>
      
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Dernière mise à jour</span>
          <span className="font-mono">
            {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;