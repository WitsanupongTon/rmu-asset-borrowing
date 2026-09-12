import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import Swal from 'sweetalert2';
import socket from '../socket'; // 📌 Import socket เข้ามาใช้งาน

export default function AdminLayout() {
  const navigate = useNavigate();
  const [user] = useState(() => JSON.parse(localStorage.getItem('user')) || {});
  
  const [stats, setStats] = useState({ categories: 0, borrowed: 0, overdue: 0 });
  
  const [notifications, setNotifications] = useState({
    approveUsers: 0,
    borrowRequests: 0,
    returns: 0,
    history: 0
  });

  // 📌 1. เก็บ ID ของรายการดิบทั้งหมด เพื่อนำไปเทียบว่าอันไหนดูแล้ว
  const [rawIds, setRawIds] = useState({
    approveUsers: [],
    borrowRequests: [],
    returns: [],
    history: []
  });

  // 📌 ฟังก์ชันดึงข้อมูลสรุป และคำนวณแจ้งเตือน
  const fetchStats = useCallback(async (isInitial = false) => {
    try {
      const [borrowsRes, itemsRes] = await Promise.all([
        API.get('/borrows/admin/all').catch(() => ({ data: [] })),
        API.get('/items').catch(() => ({ data: [] }))
      ]);
      
      let pendingUserIds = [];
      try {
        const usersRes = await API.get('/users/all');
        const usersData = Array.isArray(usersRes.data) 
          ? usersRes.data 
          : (usersRes.data.users || usersRes.data.data || []);
        pendingUserIds = usersData.filter(u => u.status === 'pending').map(u => u._id);
      } catch (e) {
        console.log("ไม่สามารถดึงข้อมูลผู้ใช้");
      }
      
      const now = new Date();
      let totalBorrowed = 0;
      
      let overdueIds = [];
      let pendingBorrowIds = [];
      let recentHistoryIds = [];

      borrowsRes.data.forEach(record => {
        if (record.status === 'approved') {
          totalBorrowed += record.quantity || 1;
          if (record.dueDate && new Date(record.dueDate) < now) {
            overdueIds.push(record._id); // เก็บ ID รายการที่เกินกำหนด
          }
        } 
        else if (record.status === 'pending') {
          pendingBorrowIds.push(record._id); // เก็บ ID คำขอใหม่
        }
        else if (record.status === 'returned' || record.status === 'rejected') {
          const updateTime = new Date(record.updatedAt || record.createdAt);
          if (now - updateTime < 86400000) { 
            recentHistoryIds.push(record._id); // เก็บ ID ประวัติล่าสุดภายใน 24 ชม.
          }
        }
      });

      setStats({
        categories: itemsRes.data.length,
        borrowed: totalBorrowed,
        overdue: overdueIds.length
      });

      // บันทึก ID ดิบลง State
      const newRawIds = {
        approveUsers: pendingUserIds,
        borrowRequests: pendingBorrowIds,
        returns: overdueIds,
        history: recentHistoryIds
      };
      setRawIds(newRawIds);

      // ดึงประวัติ ID ที่เคยเปิดดูแล้วจาก LocalStorage
      const seenIds = JSON.parse(localStorage.getItem('seenNotificationIds')) || {
        approveUsers: [], borrowRequests: [], returns: [], history: []
      };

      // คำนวณจำนวนแจ้งเตือนเฉพาะ ID ที่ยังไม่เคยถูกเปิดดู
      setNotifications({
        approveUsers: newRawIds.approveUsers.filter(id => !(seenIds.approveUsers || []).includes(id)).length,
        borrowRequests: newRawIds.borrowRequests.filter(id => !(seenIds.borrowRequests || []).includes(id)).length,
        returns: newRawIds.returns.filter(id => !(seenIds.returns || []).includes(id)).length,
        history: newRawIds.history.filter(id => !(seenIds.history || []).includes(id)).length
      });

      // แจ้งเตือน Popup (จะแสดงเฉพาะตอนเข้าหน้าเว็บครั้งแรก)
      if (isInitial && overdueIds.length > 0) {
        Swal.fire({
          icon: 'warning',
          title: 'มีรายการเกินกำหนด!',
          text: `มีรายการอุปกรณ์ที่เกินกำหนดคืนจำนวน ${overdueIds.length} รายการ กรุณาตรวจสอบ`,
          confirmButtonColor: '#d33',
          timer: 5000
        });
      }

    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    // ดึงข้อมูลครั้งแรกเมื่อโหลด Layout
    fetchStats(true);

    // ⚡ เช็คและเชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักฟัง Real-time Event
    const handleUpdate = () => {
      fetchStats(false);
    };

    // ⚡ ผูก Event Listeners ครอบคลุมทุกการเปลี่ยนแปลงในระบบ
    socket.on('borrow_updated', handleUpdate);
    socket.on('borrowsUpdated', handleUpdate);
    socket.on('itemsUpdated', handleUpdate);
    socket.on('inventory_updated', handleUpdate);
    socket.on('users_updated', handleUpdate);

    // ⚡ คืนค่าลบ Event Listeners เมื่อ Unmount Component
    return () => {
      socket.off('borrow_updated', handleUpdate);
      socket.off('borrowsUpdated', handleUpdate);
      socket.off('itemsUpdated', handleUpdate);
      socket.off('inventory_updated', handleUpdate);
      socket.off('users_updated', handleUpdate);
    };
  }, [fetchStats]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // 📌 ปรับฟังก์ชันเคลียร์แจ้งเตือน บันทึก ID ที่ดูกดแล้วลง LocalStorage
  const handleClearNotification = (badgeKey) => {
    if (badgeKey) {
      const seenIds = JSON.parse(localStorage.getItem('seenNotificationIds')) || {
        approveUsers: [], borrowRequests: [], returns: [], history: []
      };
      
      const currentSeenForBadge = seenIds[badgeKey] || [];
      const currentRawForBadge = rawIds[badgeKey] || [];
      
      // รวม ID ปัจจุบันเข้ากับ ID ที่เคยเปิดดูแล้ว
      seenIds[badgeKey] = Array.from(new Set([...currentSeenForBadge, ...currentRawForBadge]));
      
      // บันทึกกลับลง LocalStorage
      localStorage.setItem('seenNotificationIds', JSON.stringify(seenIds));
      
      // อัปเดต UI ให้จุด Badge หายไปทันที
      setNotifications(prev => ({ ...prev, [badgeKey]: 0 }));
    }
  };

  const navItems = [
    { label: '🏠 Dashboard', path: '/admin' },
    { label: '🕹️ ยืมอุปกรณ์', path: '/admin/borrow' },
    { label: '📦 จัดการคลัง', path: '/admin/inventory' },
    { label: '🎥 จัดการผู้ใช้', path: '/admin/users' },
    { label: '📋 อนุมัติสมาชิก', path: '/admin/approve-users', badgeKey: 'approveUsers' },
    { label: '📋 คำร้องขอยืม', path: '/admin/borrow-requests', badgeKey: 'borrowRequests' },
    { label: '🕹️ จัดการการคืน', path: '/admin/returns', badgeKey: 'returns' },
    { label: '📊 ประวัติยืม-คืน', path: '/admin/history', badgeKey: 'history' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-600 via-purple-600 to-purple-800 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        
        <div className="bg-white rounded-2xl p-4 shadow-md flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl text-2xl">📋</div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">ระบบยืม-คืนอุปกรณ์</h1>
              <p className="text-xs text-gray-500 font-medium">
                ยินดีต้อนรับ, <span className="font-bold text-gray-800">{user.fullName || user.username || 'admin'}</span> ({user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'})
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition shadow-sm cursor-pointer"
          >
            🚪 ออกจากระบบ
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-md flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg text-2xl">📦</div>
            <div>
              <p className="text-gray-800 font-bold text-xl">{stats.categories} <span className="text-sm font-normal text-gray-500">ประเภทอุปกรณ์</span></p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg text-2xl">📤</div>
            <div>
              <p className="text-gray-800 font-bold text-xl">{stats.borrowed} <span className="text-sm font-normal text-gray-500">อุปกรณ์ที่ถูกยืม</span></p>
            </div>
          </div>
          <div className={`bg-white rounded-xl p-4 shadow-md flex items-center gap-4 ${stats.overdue > 0 ? 'border-2 border-red-500 bg-red-50' : ''}`}>
            <div className="p-3 bg-amber-100 rounded-lg text-2xl">⚠️</div>
            <div>
              <p className={`font-bold text-xl ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {stats.overdue} <span className={`text-sm font-normal ${stats.overdue > 0 ? 'text-red-500' : 'text-gray-500'}`}>เกินกำหนด</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              onClick={() => handleClearNotification(item.badgeKey)}
              className={({ isActive }) =>
                `relative px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 shadow ${
                  isActive
                    ? 'bg-purple-900 text-white ring-2 ring-purple-300'
                    : 'bg-white text-gray-700 hover:bg-purple-50'
                }`
              }
            >
              {item.label}
              
              {item.badgeKey && notifications[item.badgeKey] > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-md z-10 animate-bounce">
                  {notifications[item.badgeKey]}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 min-h-137.5 mt-2">
          <Outlet />
        </div>

      </div>
    </div>
  );
}