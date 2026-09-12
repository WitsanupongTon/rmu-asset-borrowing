import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    department: ''
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">ลงทะเบียนเข้าใช้งาน</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4 text-sm">{success}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อผู้ใช้งาน (Username)</label>
            <input
              type="text"
              required
              className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">รหัสผ่าน (Password)</label>
            <input
              type="password"
              required
              className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อ - นามสกุล</label>
            <input
              type="text"
              required
              className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">หน่วยงาน / คณะ</label>
            <input
              type="text"
              required
              className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition"
          >
            สมัครสมาชิก
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          มีบัญชีอยู่แล้ว? <Link to="/login" className="text-blue-600 hover:underline">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}