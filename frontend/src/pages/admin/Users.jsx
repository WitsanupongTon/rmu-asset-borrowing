import { useState, useEffect } from 'react';
import API from '../../api/axios';
import Swal from 'sweetalert2';
import socket from '../../socket'; // 📌 นำเข้า Socket Instance ส่วนกลาง

export default function Users() {
  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('user')) || {});
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 📌 State สำหรับการแบ่งหน้า
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    _id: '', username: '', password: '', fullName: '', role: 'user'
  });

  useEffect(() => {
    fetchUsers();

    // ⚡ ตรวจสอบการเชื่อมต่อ Socket
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักรับ Event เมื่อมีข้อมูลผู้ใช้เปลี่ยนแปลง
    const handleUsersUpdated = () => {
      fetchUsers();
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'ข้อมูลผู้ใช้มีการอัปเดต!',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    };

    // ⚡ ผูก Event Listeners (รองรับทั้ง usersUpdated และ itemsUpdated)
    socket.on('usersUpdated', handleUsersUpdated);
    socket.on('itemsUpdated', handleUsersUpdated);

    // ⚡ คืนค่าเพื่อลบ Specific Listener เมื่อ Component Unmount (ไม่ใช้ socket.disconnect())
    return () => {
      socket.off('usersUpdated', handleUsersUpdated);
      socket.off('itemsUpdated', handleUsersUpdated);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await API.get('/users/all'); 
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setIsEditing(true);
      setFormData({ ...user, password: '' }); 
    } else {
      setIsEditing(false);
      setFormData({ _id: '', username: '', password: '', fullName: '', role: 'user' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await API.put(`/users/${formData._id}`, formData);
        Swal.fire({ icon: 'success', title: 'อัปเดตสำเร็จ', timer: 1500, showConfirmButton: false });
      } else {
        await API.post('/users/add', formData);
        Swal.fire({ icon: 'success', title: 'เพิ่มผู้ใช้สำเร็จ', timer: 1500, showConfirmButton: false });
      }
      setShowModal(false);
      fetchUsers(); // 🔄 ดึงข้อมูลใหม่ทันทีหลังบันทึก
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: err.response?.data?.message || 'ไม่สามารถบันทึกได้' });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        await API.delete(`/users/${id}`);
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', timer: 1500, showConfirmButton: false });
        fetchUsers(); // 🔄 ดึงข้อมูลใหม่ทันทีหลังลบ
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถลบผู้ใช้นี้ได้' });
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 📌 คำนวณข้อมูลสำหรับการแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 relative">
      {/* ส่วนบน: หัวข้อและการค้นหา */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-md border border-black/10">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          <span className="text-2xl">🎥</span> จัดการผู้ใช้
        </h2>
        <div className="flex gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="ค้นหา Username หรือชื่อจริง..." 
            className="border border-black/10 p-2 rounded-lg w-full md:w-64 text-sm outline-none focus:ring-2 focus:ring-purple-400"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // รีเซ็ตกลับไปหน้า 1 เสมอเมื่อมีการค้นหา
            }}
          />
          <button onClick={() => handleOpenModal()} className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shadow transition cursor-pointer">
            + เพิ่มผู้ใช้ใหม่
          </button>
        </div>
      </div>

      {/* ส่วนล่าง: ตารางข้อมูลพร้อมแบ่งหน้า */}
      <div className="rounded-xl border border-black/10 shadow-md bg-white flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-700 text-sm border-b border-black/10">
                <th className="p-4 font-semibold">ชื่อผู้ใช้</th>
                <th className="p-4 font-semibold">ชื่อ-นามสกุล</th>
                <th className="p-4 font-semibold">บทบาท</th>
                <th className="p-4 font-semibold text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((u) => (
                  <tr key={u._id} className="border-b border-black/10 hover:bg-gray-50 text-sm">
                    <td className="p-4 font-medium text-gray-800">{u.username}</td>
                    <td className="p-4 text-gray-600">{u.fullName}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${u.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'}`}>
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {currentUser._id === u._id ? (
                        <span className="text-gray-400 text-xs font-semibold">ผู้ใช้ปัจจุบัน</span>
                      ) : (
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleOpenModal(u)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium flex items-center gap-1 transition cursor-pointer">
                            ✏️ แก้ไข
                          </button>
                          <button onClick={() => handleDelete(u._id)} className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium flex items-center gap-1 transition cursor-pointer">
                            🗑️ ลบ
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center p-8 text-gray-500 text-sm">
                    ไม่พบข้อมูลผู้ใช้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ส่วนแบ่งหน้า (Pagination) */}
        {filteredUsers.length > 0 && (
          <div className="flex justify-between items-center p-4 bg-gray-50 border-t border-black/10 rounded-b-xl">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                currentPage === 1 
                  ? 'bg-gray-200 text-gray-400 cursor-default opacity-60' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 shadow-sm cursor-pointer'
              }`}
            >
              ◀ ก่อนหน้า
            </button>
            
            <span className="text-sm text-gray-600 font-medium">
              หน้า {currentPage} จาก {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                currentPage === totalPages 
                  ? 'bg-gray-200 text-gray-400 cursor-default opacity-60' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 shadow-sm cursor-pointer'
              }`}
            >
              ถัดไป ▶
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-black/10">
            <h3 className="text-lg font-bold mb-4 text-gray-800">
              {isEditing ? '✏️ แก้ไขผู้ใช้' : '🎥 เพิ่มผู้ใช้ใหม่'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">ชื่อผู้ใช้ (Username)</label>
                <input 
                  type="text" 
                  required 
                  className="w-full border border-black/10 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none" 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                  disabled={isEditing} 
                />
              </div>
              {!isEditing && (
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">รหัสผ่าน</label>
                  <input 
                    type="password" 
                    required 
                    className="w-full border border-black/10 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">ชื่อ-นามสกุล</label>
                <input 
                  type="text" 
                  required 
                  className="w-full border border-black/10 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none" 
                  value={formData.fullName} 
                  onChange={e => setFormData({...formData, fullName: e.target.value})} 
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">บทบาท</label>
                <select 
                  className="w-full border border-black/10 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none" 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition shadow-md cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}