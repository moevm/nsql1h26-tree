export default function PersonModal({ isOpen, onClose, person }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        {/* Содержимое модального окна */}
      </div>
    </div>
  );
}