import LaiXePageContent from './LaiXePageContent';

const FALLBACK = `
<h2>Đào tạo sát hạch lái xe máy hạng A1 & A</h2>
<p>SMC Training mở rộng sang lĩnh vực đào tạo sát hạch lái xe máy, cung cấp hai hạng bằng A1 và A với lộ trình học rõ ràng, giảng viên giàu kinh nghiệm và hỗ trợ thủ tục thi sát hạch.</p>
<h3>Hạng A1</h3>
<p>Dành cho người điều khiển xe mô tô hai bánh có dung tích xi-lanh đến 175 cm³. Phù hợp với đa số người học có nhu cầu lái xe máy phổ thông hàng ngày.</p>
<h3>Hạng A</h3>
<p>Dành cho người điều khiển xe mô tô hai bánh có dung tích xi-lanh từ 175 cm³ trở lên.</p>
<h3>Vì sao chọn SMC Training?</h3>
<ul>
<li>Lộ trình học lý thuyết và thực hành bài bản.</li>
<li>Hỗ trợ đăng ký hồ sơ và lịch thi sát hạch.</li>
<li>Đội ngũ giảng viên tận tâm, hướng dẫn sát thực tế.</li>
</ul>
<p>Liên hệ hotline <strong>1900 638939</strong> hoặc bấm <strong>Đăng ký</strong> để được tư vấn.</p>
`;

export default function LaiXeHome() {
  return <LaiXePageContent pageKey="lai-xe-gioi-thieu" fallback={FALLBACK} />;
}
