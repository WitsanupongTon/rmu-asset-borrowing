import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import Swal from 'sweetalert2';
import socket from '../socket'; // 📌 Import socket เข้ามาใช้งาน
import formatNumber from '../utils/formatNumber';

export default function UserLayout() {
  const navigate = useNavigate();
  const [user] = useState(() => JSON.parse(localStorage.getItem('user')) || {});
  const [stats, setStats] = useState({ categories: 0, borrowed: 0, overdue: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // 📌 ฟังก์ชันดึงข้อมูลสรุป
  const fetchStats = useCallback(async (isInitial = false) => {
    try {
      const userId = user._id || user.id || '';
      const [itemsRes, myBorrowsRes] = await Promise.all([
        API.get('/items').catch(() => ({ data: [] })),
        userId ? API.get(`/borrows/user/${userId}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);

      const items = itemsRes.data || [];
      const myBorrows = Array.isArray(myBorrowsRes.data) ? myBorrowsRes.data : [];

      // นับจำนวนชนิดพัสดุในคลังจากรายการพัสดุ ไม่ได้นับหมวดหมู่
      const itemTypesCount = items.length;

      // นับรายการที่กำลังยืมอยู่ และเกินกำหนด
      const activeBorrows = myBorrows.filter(b => b.status === 'approved' || b.status === 'borrowed');
      const now = new Date();
      const overdueCount = activeBorrows.filter(b => b.dueDate && new Date(b.dueDate) < now).length;

      setStats({
        categories: itemTypesCount,
        borrowed: activeBorrows.length,
        overdue: overdueCount
      });

      // แจ้งเตือน Popup เฉพาะตอนเข้าหน้าเว็บครั้งแรก หากมีรายการเกินกำหนด[cite: 13]
      if (isInitial && overdueCount > 0) {
        Swal.fire({
          icon: 'warning',
          title: 'คุณมีรายการเกินกำหนด!',
          text: `คุณมีพัสดุที่เกินกำหนดคืนจำนวน ${formatNumber(overdueCount)} รายการ กรุณานำมาคืนโดยเร็ว`,
          confirmButtonColor: '#d33',
          timer: 5000
        });
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // ดึงข้อมูลครั้งแรกเมื่อโหลด Layout[cite: 13]
    fetchStats(true);

    // ⚡ เช็คและเชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ[cite: 13]
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักฟัง Real-time Event[cite: 13]
    const handleUpdate = () => {
      fetchStats(false);
    };

    // ⚡ ผูก Event Listeners ที่เกี่ยวข้องกับการยืม คืน และคลังพัสดุ
    socket.on('borrow_updated', handleUpdate);
    socket.on('borrowsUpdated', handleUpdate);
    socket.on('itemsUpdated', handleUpdate);
    socket.on('inventory_updated', handleUpdate);

    // ⚡ คืนค่าลบ Event Listeners เมื่อ Unmount Component[cite: 13]
    return () => {
      socket.off('borrow_updated', handleUpdate);
      socket.off('borrowsUpdated', handleUpdate);
      socket.off('itemsUpdated', handleUpdate);
      socket.off('inventory_updated', handleUpdate);
    };
  }, [fetchStats]);

  // ฟังก์ชันออกจากระบบพร้อมการยืนยัน[cite: 14]
  const handleLogout = () => {
    Swal.fire({
      title: 'ยืนยันการออกจากระบบ?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    });
  };

  // เมนูเฉพาะของ User[cite: 14]
  const navItems = [
    { label: '🕹️ ยืมพัสดุ', path: '/borrow' },
    { label: '📊 ประวัติยืม-คืนพัสดุ', path: '/history' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-600 via-purple-600 to-purple-800 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* ส่วนที่ 1: การ์ดด้านบนสุด[cite: 14] */}
        <div className="bg-white rounded-2xl p-4 shadow-md flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl text-2xl">📋</div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">ระบบยืม-คืนพัสดุ</h1>
              <p className="text-sm text-gray-600 font-medium">
                ยินดีต้อนรับ, <span className="font-bold text-gray-800">{user.fullName || user.username || 'ผู้ใช้งาน'}</span> (ผู้ใช้งานทั่วไป)
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition shadow-sm cursor-pointer"
          >
            🚪 ออกจากระบบ
          </button>
        </div>

        {/* ส่วนที่ 2: การ์ดตัวเลขสรุป 3 ช่อง[cite: 14] */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-md flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg text-2xl">📦</div>
            <div>
              <p className="text-gray-800 font-bold text-xl">{isStatsLoading ? '...' : formatNumber(stats.categories)} <span className="text-sm font-normal text-gray-500">ชนิดพัสดุในคลัง</span></p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg text-2xl">📤</div>
            <div>
              <p className="text-gray-800 font-bold text-xl">{isStatsLoading ? '...' : formatNumber(stats.borrowed)} <span className="text-sm font-normal text-gray-500">พัสดุที่คุณยืม</span></p>
            </div>
          </div>
          <div className={`bg-white rounded-xl p-4 shadow-md flex items-center gap-4 ${stats.overdue > 0 ? 'border-2 border-red-500 bg-red-50' : ''}`}>
            <div className="p-3 bg-amber-100 rounded-lg text-2xl">⚠️</div>
            <div>
              <p className={`font-bold text-xl ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {isStatsLoading ? '...' : formatNumber(stats.overdue)} <span className={`text-sm font-normal ${stats.overdue > 0 ? 'text-red-500' : 'text-gray-500'}`}>รายการเกินกำหนด</span>
              </p>
            </div>
          </div>
        </div>

        {/* ส่วนที่ 3: เมนูปุ่มกดเปลี่ยนหน้า[cite: 14] */}
        <div className="flex flex-wrap gap-2 pt-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `px-4 py-2.5 rounded-xl text-sm md:text-base font-semibold transition-all duration-200 shadow ${
                  isActive
                    ? 'bg-purple-900 text-white ring-2 ring-purple-300'
                    : 'bg-white text-gray-700 hover:bg-purple-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* ส่วนที่ 4: พื้นที่แสดงเนื้อหาของแต่ละหน้า[cite: 14] */}
        <div className="bg-white rounded-2xl shadow-xl p-6 min-h-137.5 mt-2">
          <Outlet />
        </div>

      </div>
    </div>
  );
}