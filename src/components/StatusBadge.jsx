export default function StatusBadge({ status, lang = 'en', style }) {
  if (!status) return null;
  return (
    <span className="badge" style={{ color: status.color, background: status.bg, ...style }}>
      <span className="badge-dot" />{lang === 'ar' ? status.ar : status.en}
    </span>
  );
}
