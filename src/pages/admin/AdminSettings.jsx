import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, Wifi, Server } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [form, setForm] = useState({
    site_name: '',
    logo_url: '',
    email: '',
    phone: '',
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    smtp_encryption: 'tls',
    maintenance_mode: false,
    maintenance_message: '',
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      const data = res.data || res.settings || res;
      setForm(prev => ({
        ...prev,
        site_name: data.site_name || data.siteName || '',
        logo_url: data.logo_url || data.logoUrl || '',
        email: data.email || data.contact_email || '',
        phone: data.phone || data.contact_phone || '',
        smtp_host: data.smtp_host || data.smtpHost || '',
        smtp_port: data.smtp_port || data.smtpPort || '',
        smtp_user: data.smtp_user || data.smtpUser || '',
        smtp_pass: data.smtp_pass || data.smtpPass || '',
        smtp_encryption: data.smtp_encryption || data.smtpEncryption || 'tls',
        maintenance_mode: data.maintenance_mode || data.maintenanceMode || false,
        maintenance_message: data.maintenance_message || data.maintenanceMessage || 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
      }));
    } catch (err) {
      toast.error('Không thể tải cài đặt.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(form);
      toast.success('Đã lưu cài đặt thành công.');
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu cài đặt.');
    } finally {
      setSaving(false);
    }
  };

  const handleHealthCheck = async () => {
    setTestingConnection(true);
    try {
      const res = await api.healthCheck();
      if (res.data?.status === 'ok' || res.status === 'ok' || res.ok) {
        toast.success('Máy chủ hoạt động bình thường.');
      } else {
        toast.error('Máy chủ có vấn đề.');
      }
    } catch (err) {
      toast.error('Không thể kết nối tới máy chủ.');
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Cài đặt hệ thống"
        subtitle="Cấu hình hệ thống SMC Training"
        action={
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        }
      />

      <div className="space-y-6 max-w-3xl">
        {/* General Info */}
        <div className="card">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-smc-500" />
            Thông tin chung
          </h3>
          <div className="space-y-4">
            <div>
              <label className="input-label">Tên trang web</label>
              <input name="site_name" value={form.site_name} onChange={handleChange} className="input-field" placeholder="SMC Training" />
            </div>
            <div>
              <label className="input-label">Logo URL</label>
              <input name="logo_url" value={form.logo_url} onChange={handleChange} className="input-field" placeholder="https://example.com/logo.png" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Email liên hệ</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="input-field" placeholder="contact@smc.vn" />
              </div>
              <div>
                <label className="input-label">Số điện thoại</label>
                <input name="phone" value={form.phone} onChange={handleChange} className="input-field" placeholder="0900000000" />
              </div>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="card">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-smc-500" />
            Cấu hình email (SMTP)
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">SMTP Host</label>
                <input name="smtp_host" value={form.smtp_host} onChange={handleChange} className="input-field" placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="input-label">SMTP Port</label>
                <input name="smtp_port" value={form.smtp_port} onChange={handleChange} className="input-field" placeholder="587" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Tài khoản SMTP</label>
                <input name="smtp_user" value={form.smtp_user} onChange={handleChange} className="input-field" placeholder="email@gmail.com" />
              </div>
              <div>
                <label className="input-label">Mật khẩu SMTP</label>
                <input name="smtp_pass" type="password" value={form.smtp_pass} onChange={handleChange} className="input-field" placeholder="••••••••" />
              </div>
            </div>
            <div>
              <label className="input-label">Mã hóa</label>
              <select name="smtp_encryption" value={form.smtp_encryption} onChange={handleChange} className="input-field w-40">
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="none">Không</option>
              </select>
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="card">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-smc-500" />
            Chế độ bảo trì
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="maintenance_mode"
                checked={form.maintenance_mode}
                onChange={handleChange}
                className="w-5 h-5 rounded accent-smc-500"
              />
              <span className="text-sm font-medium text-gray-700">Bật chế độ bảo trì</span>
            </label>
            {form.maintenance_mode && (
              <div>
                <label className="input-label">Thông báo bảo trì</label>
                <textarea
                  name="maintenance_message"
                  value={form.maintenance_message}
                  onChange={handleChange}
                  className="input-field min-h-[80px]"
                  placeholder="Hệ thống đang bảo trì..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Health Check */}
        <div className="card">
          <h3 className="text-base font-bold text-gray-900 mb-4">Kiểm tra hệ thống</h3>
          <p className="text-sm text-gray-500 mb-3">Kiểm tra kết nối và trạng thái máy chủ.</p>
          <button
            onClick={handleHealthCheck}
            disabled={testingConnection}
            className="btn-secondary"
          >
            <Wifi className="w-4 h-4 mr-2" />
            {testingConnection ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
          </button>
        </div>
      </div>
    </div>
  );
}
