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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">ระบบยืม-คืนพัสดุ</h2>
        <p className="text-center text-gray-500 text-sm mb-6">สำนักงานกองกลาง มรภ.มหาสารคาม</p>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อผู้ใช้งาน</label>
            <input
              type="text"
              required
              className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">รหัสผ่าน</label>
            <input
              type="password"
              required
              className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition"
          >
            เข้าสู่ระบบ
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          ยังไม่มีบัญชีผู้ใช้งาน? <Link to="/register" className="text-blue-600 hover:underline">ลงทะเบียนที่นี่</Link>
        </p>
      </div>
    </div>
  );
}