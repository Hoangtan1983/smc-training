import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'Xác nhận', variant = 'danger' }) {
  return (
    <Modal open={open} onClose={onClose} title="" size="sm">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title || 'Xác nhận xóa?'}</h3>
        <p className="text-sm text-gray-500 mb-5">{message || 'Hành động này không thể hoàn tác.'}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onClose} className="btn-secondary btn-sm flex-1">Hủy</button>
          <button onClick={onConfirm} className={`btn-sm flex-1 ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
