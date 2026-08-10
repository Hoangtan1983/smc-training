export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon className="empty-state-icon" />}
      <p className="empty-state-text">{title || 'Không có dữ liệu'}</p>
      {description && <p className="empty-state-sub">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
