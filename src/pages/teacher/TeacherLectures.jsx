import { BookOpen } from 'lucide-react';
import FileManager from './FileManager';

export default function TeacherLectures() {
  return (
    <FileManager
      type="lecture"
      label="giảng"
      iconColor="text-green-600 bg-green-50"
      Icon={BookOpen}
    />
  );
}
