import LaiXePageContent from './LaiXePageContent';

const FALLBACK = `
<h2>Hạng A — Xe máy từ 175 cm³ trở lên</h2>
<p>Hạng A cho phép điều khiển xe mô tô hai bánh có dung tích xi-lanh từ 175 cm³ trở lên, bao gồm các dòng xe phân khối lớn.</p>
<h3>Nội dung đào tạo</h3>
<ul>
<li>Lý thuyết Luật Giao thông đường bộ.</li>
<li>Kỹ năng thực hành sa hình nâng cao trên xe phân khối lớn.</li>
<li>Hướng dẫn thủ tục hồ sơ và lịch thi sát hạch.</li>
</ul>
<h3>Đối tượng phù hợp</h3>
<p>Người từ đủ 18 tuổi, có nhu cầu điều khiển xe mô tô phân khối lớn hoặc nâng hạng bằng lái.</p>
<p>Liên hệ hotline <strong>1900 638939</strong> hoặc bấm <strong>Đăng ký</strong> để được tư vấn.</p>
`;

export default function LaiXeHangA() {
  return <LaiXePageContent pageKey="lai-xe-hang-a" fallback={FALLBACK} />;
}
