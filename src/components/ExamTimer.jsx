import { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function ExamTimer({ durationMinutes, onTimeUp, paused }) {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (paused || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => onTimeUpRef.current?.(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, timeLeft <= 0]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const isLow = timeLeft < 300; // < 5 min warning

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-bold ${
      isLow ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'
    }`}>
      {isLow ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
