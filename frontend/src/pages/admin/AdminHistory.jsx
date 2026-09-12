import { useState, useEffect } from 'react';
import API from '../../api/axios'; 
import LoadingState from '../../components/LoadingState';
import Swal from 'sweetalert2';
import socket from '../../socket'; // 📌 Import socket เข้ามาใช้งาน

export default function AdminHistory() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 📌 State สำหรับการแบ่งหน้า
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchHistory();

    // ⚡ เชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักฟังเมื่อมีการอัปเดตข้อมูลประวัติการยืม-คืน
    const handleHistoryUpdated = () => {
      fetchHistory();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'ประวัติการยืม-คืน มีการอัปเดต!',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    };

    // ⚡ ผูก Event Listeners (รองรับหลายชื่อ event จาก backend)
    socket.on('borrow_updated', handleHistoryUpdated);
    socket.on('borrowsUpdated', handleHistoryUpdated);
    socket.on('itemsUpdated', handleHistoryUpdated);

    // ⚡ คืนค่าเพื่อลบ Specific Listener เมื่อ Component Unmount (ไม่ใช้ socket.disconnect())
    return () => {
      socket.off('borrow_updated', handleHistoryUpdated);
      socket.off('borrowsUpdated', handleHistoryUpdated);
      socket.off('itemsUpdated', handleHistoryUpdated);
    };
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await API.get('/borrows/admin/all');
      
      const sortedData = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistory(sortedData);
    } catch (error) {
      console.error("Error fetching history", error);
      Swal.fire('ผิดพลาด', 'ไม่สามารถดึงข้อมูลประวัติได้', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const renderStatus = (record) => {
    if (record.status === 'pending') {
      return <span className="bg-yellow-100 text-yellow-700 font-bold px-3 py-1 rounded-full text-xs">🟡 กำลังร้องขอ</span>;
    }
    
    if (record.status === 'returned') {
      return <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs">🟢 คืนแล้ว</span>;
    }

    if (record.status === 'rejected') {
      return <span className="bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full text-xs">⚫ ไม่อนุมัติ</span>;
    }

    if (record.status === 'approved') {
      const dueDate = record.dueDate ? new Date(record.dueDate) : null;
      const isOverdue = dueDate && new Date() > dueDate;
      
      if (isOverdue) {
        return <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-xs">🔴 เลยกำหนด</span>;
      }
      return <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-xs">🔵 กำลังยืมอยู่</span>;
    }

    return null;
  };

  const filteredHistory = history.filter(record => 
    record.item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    record.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 📌 คำนวณข้อมูลสำหรับการแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) {
    return <LoadingState message="กำลังโหลดประวัติการยืม-คืน..." />;
  }

  return (
    <div className="space-y-6 relative">
      {/* ส่วนบน: หัวข้อและการค้นหา */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-md border border-black/10">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          📊 ประวัติการยืม-คืน
        </h2>
        <div className="relative w-full md:w-80">
          <input 
            type="text" 
            placeholder="ค้นหาชื่ออุปกรณ์ หรือ ชื่อผู้ยืม..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // รีเซ็ตกลับไปหน้า 1 เสมอเมื่อมีการค้นหา
            }}
            className="w-full border border-black/10 pl-4 pr-10 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
          />
          <span className="absolute right-3 top-2.5 text-gray-400 text-sm">🔍</span>
        </div>
      </div>

      {/* ส่วนล่าง: ตารางข้อมูล */}
      <div className="rounded-xl border border-black/10 shadow-md bg-white flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-175">
            <thead>
              <tr className="bg-gray-50 text-gray-700 text-sm font-semibold border-b border-black/10">
                <th className="p-4">รูปภาพ</th>
                <th className="p-4">อุปกรณ์</th>
                <th className="p-4">ผู้ยืม</th>
                <th className="p-4 text-center">จำนวน</th>
                <th className="p-4 text-center">วันที่ขอยืม</th>
                <th className="p-4 text-center">กำหนดคืน</th>
                <th className="p-4 text-center">วันที่คืน</th>
                <th className="p-4 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((record) => (
                  <tr key={record._id} className="border-b border-black/10 hover:bg-gray-50 transition text-sm">
                    <td className="p-4">
                      <img 
                        src={record.item?.image || "https://placehold.co/150"} 
                        alt={record.item?.name} 
                        className="w-12 h-12 object-cover rounded-lg border border-black/10 shadow-sm"
                      />
                    </td>
                    <td className="p-4 font-medium text-gray-800">{record.item?.name || 'ไม่พบอุปกรณ์'}</td>
                    <td className="p-4 text-gray-600">{record.user?.username || record.user?.name || 'ไม่ระบุตัวตน'}</td>
                    <td className="p-4 text-center text-gray-600">{record.quantity}</td>
                    
                    {/* วันที่ขอยืม */}
                    <td className="p-4 text-center text-gray-600">
                      {formatDate(record.borrowDate || record.createdAt)}
                    </td>
                    
                    {/* วันที่กำหนดคืน */}
                    <td className="p-4 text-center text-gray-600">
                      {record.status === 'pending' || record.status === 'rejected' 
                        ? '-' 
                        : formatDate(record.dueDate)}
                    </td>
                    
                    {/* วันที่คืนของจริง */}
                    <td className="p-4 text-center text-gray-600">
                      {record.status === 'returned' && record.returnDate 
                        ? formatDate(record.returnDate) 
                        : '-'}
                    </td>
                    
                    <td className="p-4 text-center">
                      {renderStatus(record)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center p-8 text-gray-500 text-sm">
                    ไม่พบข้อมูลประวัติการยืม-คืน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* ส่วนแบ่งหน้า (Pagination) */}
        {filteredHistory.length > 0 && (
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