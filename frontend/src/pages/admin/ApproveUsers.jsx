import { useState, useEffect } from 'react';
import API from '../../api/axios';
import Swal from 'sweetalert2';
import socket from '../../socket'; // 📌 Import socket เข้ามาใช้งาน

export default function ApproveUsers() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // 📌 State สำหรับการแบ่งหน้า
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchUsers();

    // ⚡ เชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักฟังเมื่อมีผู้ใช้ลงทะเบียนใหม่หรือมีการอัปเดตข้อมูลผู้ใช้
    const handleUsersUpdated = () => {
      fetchUsers();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'มีการอัปเดตคำร้องสมัครสมาชิก!',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    };

    // ⚡ ผูก Event Listeners (รองรับทั้ง usersUpdated และ users_updated)
    socket.on('usersUpdated', handleUsersUpdated);
    socket.on('users_updated', handleUsersUpdated);

    // ⚡ คืนค่าเพื่อลบ Specific Listener เมื่อ Component Unmount (ไม่ใช้ socket.disconnect())
    return () => {
      socket.off('usersUpdated', handleUsersUpdated);
      socket.off('users_updated', handleUsersUpdated);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await API.get('/users/all');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleUpdateStatus = async (id, status, fullName) => {
    const isApprove = status === 'approved';
    const actionText = isApprove ? 'อนุมัติ' : 'ปฏิเสธ';

    const result = await Swal.fire({
      title: `ยืนยันการ${actionText}?`,
      text: `คุณต้องการ${actionText}ผู้ใช้งาน "${fullName}" ใช่หรือไม่?`,
      icon: isApprove ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: isApprove ? '#22c55e' : '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: `ยืนยัน${actionText}`,
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        await API.put(`/users/${id}`, { status });
        Swal.fire({
          icon: 'success',
          title: `${actionText}เรียบร้อยแล้ว`,
          timer: 1500,
          showConfirmButton: false
        });
        fetchUsers();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถอัปเดตสถานะได้' });
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  };

  // กรองเฉพาะคนที่สถานะเป็น 'pending' (รออนุมัติ) และตรงกับคำค้นหา
  const filteredUsers = users.filter(u =>
    u.status === 'pending' &&
    (u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 📌 คำนวณข้อมูลสำหรับการแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-md border border-black/10">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">📋</span> อนุมัติคำร้องสมาชิกใหม่
        </h2>
        
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="ค้นหา Username หรือชื่อจริง..."
            className="w-full pl-4 pr-10 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // รีเซ็ตกลับไปหน้า 1 เสมอเมื่อมีการค้นหา
            }}
          />
          <span className="absolute right-3 top-2.5 text-gray-400 text-sm">🔍</span>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 shadow-md bg-white flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm font-semibold border-b border-black/10">
                <th className="p-4">ชื่อผู้ใช้</th>
                <th className="p-4">ชื่อ-นามสกุล</th>
                <th className="p-4">วันที่สมัคร</th>
                <th className="p-4">สถานะ</th>
                <th className="p-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((u) => (
                  <tr key={u._id} className="border-b border-black/10 hover:bg-gray-50 text-sm text-gray-700">
                    <td className="p-4 font-semibold text-gray-900">{u.username}</td>
                    <td className="p-4">{u.fullName}</td>
                    <td className="p-4">{formatDate(u.createdAt)}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        รอการยืนยัน
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleUpdateStatus(u._id, 'approved', u.fullName)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition shadow-sm cursor-pointer"
                        >
                          อนุมัติ
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(u._id, 'rejected', u.fullName)}
                          className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition shadow-sm cursor-pointer"
                        >
                          ปฏิเสธ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium text-gray-500 mt-2">ไม่มีคำร้องรออนุมัติ</p>
                    </div>
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
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 shadow-sm hover:cursor-pointer'
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
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 shadow-sm hover:cursor-pointer'
              }`}
            >
              ถัดไป ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
}