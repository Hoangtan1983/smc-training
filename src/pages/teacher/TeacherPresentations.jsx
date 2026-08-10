import { Monitor } from 'lucide-react';
import FileManager from './FileManager';

export default function TeacherPresentations() {
  return (
    <FileManager
      type="presentation"
      label="thuyết trình"
      iconColor="text-blue-600 bg-blue-50"
      Icon={Monitor}
    />
  );
}
