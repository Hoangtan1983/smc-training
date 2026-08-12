import { Check, X, AlertTriangle } from 'lucide-react';

export default function QuestionCard({ question, index, selectedAnswer, onSelect, showResult }) {
  const isAnswered = selectedAnswer !== undefined && selectedAnswer !== null;
  const isCorrect = selectedAnswer === question.answer;
  const optionLabels = ['A', 'B', 'C', 'D'];
  const isTrueFalse = question.type === 'true_false';
  const options = question.options || [];
  const isMCQ = options.length > 2;

  const getOptionStyle = (i) => {
    if (!showResult) {
      if (selectedAnswer === i) return 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm';
      return 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30';
    }
    // Show result mode
    if (i === question.answer) return 'bg-green-50 border-green-500 text-green-700';
    if (selectedAnswer === i && !isCorrect) return 'bg-red-50 border-red-500 text-red-700';
    return 'bg-white border-gray-100 text-gray-400';
  };

  const getOptionIcon = (i) => {
    if (!showResult) {
      if (selectedAnswer === i) {
        return <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{optionLabels[i]}</span>;
      }
      return <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">{optionLabels[i]}</span>;
    }
    if (i === question.answer) {
      return <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center"><Check className="w-3 h-3" /></span>;
    }
    if (selectedAnswer === i && !isCorrect) {
      return <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"><X className="w-3 h-3" /></span>;
    }
    return <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs font-bold flex items-center justify-center">{optionLabels[i]}</span>;
  };

  // Question type badge
  const typeBadge = isTrueFalse
    ? { label: 'Đúng/Sai', color: 'bg-amber-100 text-amber-700' }
    : { label: 'Trắc nghiệm', color: 'bg-blue-100 text-blue-700' };

  return (
    <div className="card p-6 mb-3">
      {/* Question Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge text-xs ${typeBadge.color}`}>{typeBadge.label}</span>
            {question.module_id && (
              <span className="text-xs text-gray-400 uppercase">{question.module_id}</span>
            )}
            {question.difficulty && (
              <span className="text-xs text-gray-400">• {question.difficulty}</span>
            )}
          </div>
          <p className="text-gray-900 font-medium leading-relaxed text-[15px]">
            {question.question || question.q || ''}
          </p>

          {/* Explanation shown after answering */}
          {showResult && question.explanation && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {isCorrect ? (
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <strong>{isCorrect ? 'Chính xác!' : 'Chưa chính xác'}</strong>
                  <p className="mt-0.5 opacity-80">{question.explanation}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2.5 ml-12">
        {options.map((opt, i) => (
          <button
            key={i}
            disabled={showResult}
            onClick={() => onSelect?.(i)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
              getOptionStyle(i)
            } ${!showResult ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'}`}
          >
            {getOptionIcon(i)}
            <span className="flex-1 text-sm">{opt}</span>
            {showResult && selectedAnswer === i && !isCorrect && (
              <X className="w-5 h-5 text-red-500 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Unanswered indicator */}
      {!isAnswered && !showResult && (
        <p className="text-xs text-gray-400 mt-3 ml-12 italic">
          Chọn một đáp án để trả lời
        </p>
      )}
    </div>
  );
}
