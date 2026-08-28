import LaiXePageContent from './LaiXePageContent';

const FALLBACK = `
<h2>Hạng A1 — Xe máy đến 125 cm³ & xe máy điện</h2>
<p>Hạng A1 cho phép điều khiển xe mô tô hai bánh có dung tích xi-lanh đến 125 cm³ hoặc có công suất động cơ điện đến 11 kW. Đây là hạng bằng phổ biến nhất cho người điều khiển xe máy (bao gồm xe máy điện) thông thường.</p>
<h3>Nội dung đào tạo</h3>
<ul>
<li>Lý thuyết Luật Trật tự Giao thông đường bộ.</li>
<li>Kỹ năng thực hành sa hình và điều khiển xe an toàn.</li>
<li>Hướng dẫn thủ tục hồ sơ và lịch thi sát hạch.</li>
</ul>
<h3>Đối tượng phù hợp</h3>
<p>Người từ đủ 18 tuổi, có nhu cầu lái xe máy phổ thông phục vụ đi lại và công việc.</p>
<p>Liên hệ hotline <strong>1900 638939</strong> hoặc bấm <strong>Đăng ký</strong> để được tư vấn.</p>
`;

export default function LaiXeHangA1() {
  return <LaiXePageContent pageKey="lai-xe-hang-a1" fallback={FALLBACK} />;
}
