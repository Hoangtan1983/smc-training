export default function StatCard({ icon: Icon, label, value, trend, color = 'smc' }) {
  const colorMap = {
    smc: 'bg-smc-50 text-smc-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <span className="stat-label">{label}</span>
        {Icon && (
          <div className={`w-10 h-10 rounded-ios-lg flex items-center justify-center ${colorMap[color] || colorMap.smc}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {trend && <div className="text-xs font-medium text-ios-green mt-1">↑ {trend}</div>}
    </div>
  );
}
