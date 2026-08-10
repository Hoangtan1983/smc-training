import { FileText } from 'lucide-react';
import FileManager from './FileManager';

export default function TeacherLessonPlans() {
  return (
    <FileManager
      type="lesson_plan"
      label="giáo án"
      iconColor="text-orange-600 bg-orange-50"
      Icon={FileText}
    />
  );
}
