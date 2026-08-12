import { Shield, MapPin, Phone, Building, ScrollText } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="pt-20 pb-12">
      <div className="page-container">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Giới thiệu</h1>
            <p className="text-lg text-gray-500">Trung tâm Đào tạo Ứng dụng Công nghệ SMC</p>
          </div>

          <div className="prose max-w-none text-gray-600 leading-relaxed space-y-6">
            <div className="card p-8 bg-gradient-to-br from-smc-50 to-white">
              <p className="text-lg">
                SMC Training là trung tâm đào tạo phi công UAV được cấp phép hoạt động theo Nghị định 288/2025/NĐ-CP
                và Thông tư 146/2025/TT-BQP. Chúng tôi cung cấp các chương trình đào tạo chuyên nghiệp từ cơ bản đến
                nâng cao, đáp ứng đầy đủ tiêu chuẩn theo NĐ 288/2025 & TT 146/2025.
              </p>
              <p>
                Với đội ngũ giảng viên giàu kinh nghiệm, cơ sở vật chất hiện đại và chương trình đào tạo chuẩn hóa,
                SMC Training cam kết mang đến cho học viên môi trường học tập tốt nhất để trở thành phi công UAV chuyên nghiệp.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              <div className="card p-5 flex items-start gap-3">
                <MapPin className="w-5 h-5 text-smc-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Địa chỉ</h3>
                  <p className="text-sm text-gray-500">Số 59 Nguyễn Thị Hoa, KP Thanh Bình, Xã Đất Đỏ, TP.HCM</p>
                </div>
              </div>
              <div className="card p-5 flex items-start gap-3">
                <Phone className="w-5 h-5 text-smc-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Liên hệ</h3>
                  <p className="text-sm text-gray-500">1900 638939 — support@smartconnect.com.vn</p>
                </div>
              </div>
              <div className="card p-5 flex items-start gap-3">
                <Building className="w-5 h-5 text-smc-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Mã số Doanh nghiệp</h3>
                  <p className="text-sm text-gray-500">0315541034-001</p>
                </div>
              </div>
              <div className="card p-5 flex items-start gap-3">
                <ScrollText className="w-5 h-5 text-smc-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Hoạt động theo</h3>
                  <p className="text-sm text-gray-500">NĐ 288/2025/NĐ-CP & TT 146/2025/TT-BQP</p>
                </div>
              </div>
            </div>

            <div className="card p-8 mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Sứ mệnh của chúng tôi</h2>
              <p>Đào tạo phi công UAV chuyên nghiệp, đáp ứng nhu cầu ngày càng cao của thị trường hàng không không người lái tại Việt Nam và quốc tế.</p>
              <p>Tuân thủ nghiêm ngặt các tiêu chuẩn theo NĐ 288/2025 & TT 146/2025, đảm bảo học viên tốt nghiệp có đủ năng lực và chứng chỉ để hành nghề.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
