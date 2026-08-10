import { BookMarked } from 'lucide-react';
import FileManager from './FileManager';

export default function TeacherSyllabus() {
  return (
    <FileManager
      type="syllabus"
      label="giáo trình"
      iconColor="text-purple-600 bg-purple-50"
      Icon={BookMarked}
    />
  );
}
