import { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, Quote } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGetFiles, apiFileUrl } from '../data/api';

/**
 * Trình soạn thảo có định dạng đơn giản (contentEditable + execCommand).
 * Không phụ thuộc thư viện ngoài — đủ cho bài viết thông thường.
 * value: chuỗi HTML; onChange(html) trả HTML để lưu.
 */
export default function RichTextEditor({ value = '', onChange }) {
  const editorRef = useRef(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [images, setImages] = useState([]);
  const [initialized, setInitialized] = useState(false);

  // Đổ HTML ban đầu vào vùng soạn (chỉ lần đầu)
  useEffect(() => {
    if (editorRef.current && !initialized) {
      editorRef.current.innerHTML = value || '';
      setInitialized(true);
    }
  }, [value, initialized]);

  const exec = (command, arg = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    onChange(editorRef.current?.innerHTML || '');
  };

  const insertLink = () => {
    const url = window.prompt('Nhập địa chỉ liên kết (https://...):');
    if (url) exec('createLink', url);
  };

  const openImagePicker = async () => {
    setShowImagePicker(true);
    try {
      const data = await apiGetFiles('public-images');
      setImages(Array.isArray(data) ? data.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f.name || '')) : []);
    } catch {
      setImages([]);
    }
  };

  const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const insertImage = (file) => {
    const alt = escHtml(file.title || file.name || '');
    const caption = (window.prompt('Chú thích ảnh (bỏ trống nếu không cần):') || '').trim();
    const img = `<img src="${apiFileUrl(file.id)}" alt="${alt}" />`;
    const html = caption ? `<figure>${img}<figcaption>${escHtml(caption)}</figcaption></figure>` : img;
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    onChange(editorRef.current?.innerHTML || '');
    setShowImagePicker(false);
  };

  const toolBtn = (cmd, arg, Icon, title) => (
    <button type="button" onClick={() => exec(cmd, arg)} title={title}
      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border border-gray-200 rounded-t-lg bg-gray-50 px-2 py-1.5">
        {toolBtn('bold', null, Bold, 'Đậm')}
        {toolBtn('italic', null, Italic, 'Nghiêng')}
        {toolBtn('underline', null, Underline, 'Gạch chân')}
        <span className="w-px h-5 bg-gray-200 mx-1" />
        {toolBtn('formatBlock', 'h2', Heading2, 'Tiêu đề lớn')}
        {toolBtn('formatBlock', 'h3', Heading3, 'Tiêu đề nhỏ')}
        {toolBtn('insertUnorderedList', null, List, 'Danh sách')}
        {toolBtn('insertOrderedList', null, ListOrdered, 'Danh sách số')}
        {toolBtn('formatBlock', 'blockquote', Quote, 'Trích dẫn')}
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" onClick={insertLink} title="Chèn liên kết"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={openImagePicker} title="Chèn ảnh từ kho"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ImageIcon className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        className="min-h-[220px] border border-t-0 border-gray-200 rounded-b-lg px-4 py-3 text-gray-800 focus:outline-none prose prose-sm max-w-none"
        data-placeholder="Gõ nội dung bài viết ở đây..."
      />

      {showImagePicker && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowImagePicker(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Chọn ảnh từ kho</h3>
              <button onClick={() => setShowImagePicker(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {images.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Chưa có ảnh nào. Hãy đăng ảnh vào mục "Tài liệu & Tư liệu → Hình ảnh công khai" trước.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map(img => (
                    <button key={img.id} onClick={() => insertImage(img)} className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-blue-500 transition-shadow">
                      <img src={apiFileUrl(img.id)} alt={img.title || img.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
