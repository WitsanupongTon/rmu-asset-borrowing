import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios'; 
import Swal from 'sweetalert2';
import socket from '../../socket'; // 📌 Import socket เข้ามาใช้งาน
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [isLoading, setIsLoading] = useState(true);

  const [borrows, setBorrows] = useState([]);
  const [items, setItems] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const PIE_COLORS = ['#00C49F', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
  const BAR_COLORS = ['#f87171', '#60a5fa', '#facc15', '#4ade80', '#c084fc'];

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      navigate('/'); 
      return;
    }
    fetchAllData();

    // ⚡ เชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักฟังข้อมูล Real-time ทุกเหตุการณ์แล้วสั่งอัปเดต Dashboard
    const handleUpdate = () => {
      fetchAllData();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'ข้อมูลภาพรวมระบบอัปเดตแล้ว!',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    };

    // ⚡ ผูก Event Listeners ครอบคลุมทุกการเปลี่ยนแปลงในระบบ
    socket.on('borrow_updated', handleUpdate);
    socket.on('borrowsUpdated', handleUpdate);
    socket.on('itemsUpdated', handleUpdate);
    socket.on('inventory_updated', handleUpdate);
    socket.on('users_updated', handleUpdate);

    // ⚡ คืนค่าเพื่อลบ Specific Listener เมื่อ Component Unmount (ไม่ใช้ socket.disconnect())
    return () => {
      socket.off('borrow_updated', handleUpdate);
      socket.off('borrowsUpdated', handleUpdate);
      socket.off('itemsUpdated', handleUpdate);
      socket.off('inventory_updated', handleUpdate);
      socket.off('users_updated', handleUpdate);
    };
  }, [user, navigate]);

  const fetchAllData = async () => {
    try {
      const [borrowsRes, itemsRes, usersRes] = await Promise.all([
        API.get('/borrows/admin/all').catch(() => ({ data: [] })),
        API.get('/items').catch(() => ({ data: [] })),
        API.get('/users/all').catch(() => ({ data: [] }))
      ]);
      
      setBorrows(borrowsRes.data);
      setItems(itemsRes.data);
      
      const usersData = Array.isArray(usersRes.data) 
        ? usersRes.data 
        : (usersRes.data.users || usersRes.data.data || []);
      setAllUsers(usersData);

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const now = new Date();
  const stats = {
    totalItems: items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    totalUsers: allUsers.length,
    pending: borrows.filter(b => b.status === 'pending').length,
    borrowed: borrows
      .filter(b => b.status === 'approved')
      .reduce((sum, b) => sum + (b.quantity || 1), 0),
    overdue: borrows.filter(b => b.status === 'approved' && new Date(b.dueDate) < now).length
  };

  const itemPopularity = {};
  borrows.forEach(b => {
    if (b.status === 'approved' || b.status === 'returned') {
      const name = b.item?.name || 'ไม่ทราบชื่อ';
      itemPopularity[name] = (itemPopularity[name] || 0) + (b.quantity || 1);
    }
  });
  
  const top5ItemsData = Object.keys(itemPopularity)
    .map(name => ({ name, อุปกรณ์: itemPopularity[name] }))
    .sort((a, b) => b.อุปกรณ์ - a.อุปกรณ์)
    .slice(0, 5);

  const categoryFreq = {};
  items.forEach(item => {
    const cat = item.category || 'ไม่มีหมวดหมู่';
    categoryFreq[cat] = (categoryFreq[cat] || 0) + (item.quantity || 1);
  });
  
  const pieData = Object.keys(categoryFreq).map(name => ({
    name,
    value: categoryFreq[name]
  }));

  const recent5Transactions = [...borrows]
    .sort((a, b) => new Date(b.createdAt || b.borrowDate) - new Date(a.createdAt || a.borrowDate))
    .slice(0, 5);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-xl text-gray-500">กำลังโหลดข้อมูลภาพรวม...</p>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @media print {
            @page {
              margin: 0; 
            }
            
            body * {
              visibility: hidden;
            }
            #printable-dashboard, #printable-dashboard * {
              visibility: visible;
            }
            #printable-dashboard {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 1.5cm; 
            }
            .no-print {
              display: none !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      <div id="printable-dashboard" className="space-y-6">
        
        <div className="flex justify-between items-center pb-2 border-b border-black/10">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            📊 ภาพรวมระบบ
          </h2>
          <button 
            onClick={handlePrint}
            className="no-print bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow flex items-center gap-2 cursor-pointer"
          >
            📄 บันทึกเป็นเอกสาร PDF
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">📦 อุปกรณ์ในระบบ</p>
            <p className="text-2xl font-bold text-gray-800">{stats.totalItems}</p>
          </div>
          <div className="bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">👥 สมาชิกทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-800">{stats.totalUsers}</p>
          </div>
          <div className="bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">⏳ คำร้องรอพิจารณา</p>
            <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
          </div>
          <div className="bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">🏃 อุปกรณ์ที่ถูกยืม</p>
            <p className="text-2xl font-bold text-gray-800">{stats.borrowed}</p>
          </div>
          <div className="bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">⚠️ เกินกำหนดส่ง</p>
            <p className="text-2xl font-bold text-gray-800">{stats.overdue}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-xl border border-black/10 shadow-md">
            <h3 className="text-sm font-bold text-gray-700 mb-4">🏆 5 อันดับอุปกรณ์ยอดนิยม</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <BarChart data={top5ItemsData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="อุปกรณ์" radius={[4, 4, 0, 0]} barSize={40}>
                    {top5ItemsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-black/10 shadow-md">
            <h3 className="text-sm font-bold text-gray-700 mb-4">📊 สัดส่วนอุปกรณ์</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-black/10 shadow-md p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4">📄 รายการล่าสุด</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-gray-600">
                  <th className="py-2 font-semibold">อุปกรณ์</th>
                  <th className="py-2 font-semibold text-center">วันที่ยืม</th>
                  <th className="py-2 font-semibold text-center">กำหนดคืน</th>
                  <th className="py-2 font-semibold text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recent5Transactions.length > 0 ? (
                  recent5Transactions.map(record => (
                    <tr key={record._id} className="border-b border-black/10 last:border-0 hover:bg-gray-50">
                      <td className="py-3 text-gray-800">
                        {record.item?.name || 'ไม่ทราบชื่อ'} <span className="text-gray-400 text-xs">(x{record.quantity})</span>
                      </td>
                      <td className="py-3 text-center text-gray-600">{formatDate(record.borrowDate || record.createdAt)}</td>
                      <td className="py-3 text-center text-gray-600">{record.status === 'pending' || record.status === 'rejected' ? '-' : formatDate(record.dueDate)}</td>
                      <td className="py-3 text-center">
                        {record.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">รออนุมัติ</span>}
                        {record.status === 'approved' && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">กำลังยืม</span>}
                        {record.status === 'returned' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">คืนแล้ว</span>}
                        {record.status === 'rejected' && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">ไม่อนุมัติ</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-4 text-gray-500">ไม่มีรายการล่าสุด</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}