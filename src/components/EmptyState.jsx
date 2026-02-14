function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon">
        <Icon size={32} />
      </div>
      <p className="empty-state-title">{title}</p>
      {subtitle ? <p className="empty-state-subtitle">{subtitle}</p> : null}
    </div>
  )
}

export default EmptyState
