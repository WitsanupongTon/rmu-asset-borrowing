import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const res = await API.post('/auth/register', formData);
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-600 via-purple-600 to-purple-800 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white p-8 shadow-2xl shadow-indigo-200/60">
        <h2 className="mb-2 text-center text-2xl font-bold text-gray-800">ลงทะเบียนเข้าใช้งาน</h2>
        <p className="mb-5 border-b border-gray-100 pb-4 text-center text-sm text-gray-500">สร้างบัญชีเพื่อขอยืมอุปกรณ์</p>
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
          <span className="font-bold">หมายเหตุ:</span> หลังสมัครสมาชิก กรุณารอ Admin อนุมัติบัญชีก่อนจึงจะเข้าสู่ระบบได้
        </div>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4 text-sm">{success}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อผู้ใช้งาน (Username)</label>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">รหัสผ่าน (Password)</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อ - นามสกุล</label>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 py-2.5 font-semibold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700"
          >
            สมัครสมาชิก
          </button>
        </form>
        <p className="mt-5 border-t border-gray-100 pt-4 text-center text-sm text-gray-600">
          มีบัญชีอยู่แล้ว? <Link to="/login" className="text-blue-600 hover:underline">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}