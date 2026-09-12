import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';

export default function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const res = await API.post('/auth/login', formData);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-600 via-purple-600 to-purple-800 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white p-8 shadow-2xl shadow-indigo-200/60">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">ระบบยืม-คืนพัสดุ</h2>
        <p className="mb-6 border-b border-gray-100 pb-4 text-center text-sm text-gray-500">สำนักงานกองกลาง มรภ.มหาสารคาม</p>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อผู้ใช้งาน</label>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">รหัสผ่าน</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 py-2.5 font-semibold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700"
          >
            เข้าสู่ระบบ
          </button>
        </form>
        <p className="mt-5 border-t border-gray-100 pt-4 text-center text-sm text-gray-600">
          ยังไม่มีบัญชีผู้ใช้งาน? <Link to="/register" className="text-blue-600 hover:underline">ลงทะเบียนที่นี่</Link>
        </p>
      </div>
    </div>
  );
}