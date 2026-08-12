import { loadData, saveData } from './store';
import { apiSyncAll } from './api';

// Seed đã chuyển toàn bộ lên PHP API (auth.php initSeed())
// File này giữ lại để tương thích ngược — sẽ load từ API nếu có token
export async function seedFromAPI(token) {
  try {
    const data = await apiSyncAll();
    saveData('courses', data.courses || []);
    saveData('classes', data.classes || []);
    saveData('enrollments', data.enrollments || []);
    saveData('attendance', data.attendance || []);
    saveData('exams', data.exams || []);
    saveData('fly_logs', data.fly_logs || []);
    saveData('certifications', data.certifications || []);
    saveData('tuitions', data.tuitions || []);
    return true;
  } catch (e) {
    console.warn('Không thể tải dữ liệu từ server, dùng cache:', e.message);
    return false;
  }
}
