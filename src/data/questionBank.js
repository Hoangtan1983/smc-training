// Ngân hàng câu hỏi - Load từ /question-bank.json
// 600 câu hỏi từ Phụ lục 2 - Bộ câu hỏi trắc nghiệm UAV
// LUÔN đọc trực tiếp, không cache flag (_loaded) — đảm bảo dữ liệu mới nhất
const ALL_QUESTIONS = [];
let _loading = false;
let _loadPromise = null;

export const MODULE_INFO = {
  m1: { name: 'Pháp luật & Quy định về UAV', icon: '📜', questionCount: 90 },
  m2: { name: 'Cấu tạo & Nguyên lý hoạt động UAV', icon: '🔧', questionCount: 90 },
  m3: { name: 'Thực hiện chuyến bay an toàn', icon: '✈️', questionCount: 90 },
  m4: { name: 'Xử lý tình huống khẩn cấp', icon: '🚨', questionCount: 90 },
  m5: { name: 'Vận hành & Bảo trì hệ thống UAV', icon: '🛡️', questionCount: 90 },
  m6: { name: 'Xử lý và phân tích dữ liệu bay', icon: '📊', questionCount: 45 },
  m7: { name: 'Sử dụng UAV hỗ trợ khẩn cấp SAR/FPR', icon: '🆘', questionCount: 50 },
  m8: { name: 'Kiến thức bổ sung nâng cao', icon: '📚', questionCount: 15 },
  m9: { name: 'Quy trình sát hạch & Đào tạo', icon: '🎓', questionCount: 25 },
  m10: { name: 'Khu vực cấm bay & Hạn chế bay', icon: '🚫', questionCount: 15 },
};

export function ensureLoaded() {
  // Nếu đã có dữ liệu, trả về ngay — không cần fetch lại file JSON (file tĩnh)
  if (ALL_QUESTIONS.length > 0) return Promise.resolve(ALL_QUESTIONS);
  if (_loading) return _loadPromise;

  _loading = true;
  _loadPromise = fetch('/question-bank.json')
    .then(r => r.json())
    .then(data => {
      ALL_QUESTIONS.length = 0;
      ALL_QUESTIONS.push(...data);
      _loading = false;
      // Cache backup vào localStorage để dùng khi offline
      try { localStorage.setItem('smc_question_bank', JSON.stringify(data)); } catch {}
      return ALL_QUESTIONS;
    })
    .catch(() => {
      const cached = JSON.parse(localStorage.getItem('smc_question_bank') || '[]');
      if (cached.length > 0) {
        ALL_QUESTIONS.length = 0;
        ALL_QUESTIONS.push(...cached);
      }
      _loading = false;
      return ALL_QUESTIONS;
    });

  return _loadPromise;
}

export function getQuestionsByModule(moduleId) {
  return ALL_QUESTIONS.filter(q => q.module_id === moduleId);
}

/**
 * Sinh đề thi trắc nghiệm theo môn học (module) — lấy toàn bộ câu hỏi
 * của môn đó và xáo trộn thứ tự. Mỗi lần gọi tạo thứ tự câu khác nhau.
 * @param {string} moduleId — mã môn (m1..m10)
 * @param {number|null} numQuestions — số câu muốn lấy; mặc định null = lấy toàn bộ.
 */
export function getExamByModule(moduleId, numQuestions = null) {
  const pool = ALL_QUESTIONS.filter(q => q.module_id === moduleId);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = numQuestions ? Math.min(numQuestions, pool.length) : pool.length;
  return pool.slice(0, count);
}

export function getAllQuestions() {
  return ALL_QUESTIONS;
}

export function getTotalQuestionCount() {
  return ALL_QUESTIONS.length;
}

// ─── Exam generation (synchronous, called after ensureLoaded) ───

/**
 * Sinh đề thi random 100 câu — luôn tạo mới, không cache
 */
export function generateRandomExam(numQuestions = 100) {
  const pool = [...ALL_QUESTIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(numQuestions, pool.length));
}

/**
 * 6 đề thi cố định — dùng pseudo-random từ seeds, luôn tạo mới mỗi lần gọi
 */
export function getExamSets() {
  const seeds = [7919, 104729, 224737, 350377, 479909, 611953];
  const sets = [];

  for (let setNum = 0; setNum < 6; setNum++) {
    let seed = seeds[setNum];
    const pseudoRandom = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };

    const copy = [...ALL_QUESTIONS];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    sets.push(copy.slice(0, 100));
  }
  return sets;
}

export function getExamSet(examNumber) {
  // Luôn tạo mới để phản ánh câu hỏi mới nhất
  const sets = getExamSets();
  return sets[(examNumber - 1) % 6] || sets[0] || [];
}

// Preload ngay khi module được import
ensureLoaded();
