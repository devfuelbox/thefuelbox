import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  duration?: number; // ms
  onClose?: () => void;
}

export default function Toast({ message, duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-4 mx-auto max-w-sm rounded-md bg-gray-800 bg-opacity-90 px-4 py-3 text-center text-sm text-white shadow-lg backdrop-blur-sm">
      {message}
    </div>
  );
}
