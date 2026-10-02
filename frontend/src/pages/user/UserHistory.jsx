import { useState, useEffect, useRef } from 'react';
import API from '../../api/axios';
import LoadingState from '../../components/LoadingState';
import PaginationBar from '../../components/PaginationBar';
import formatNumber from '../../utils/formatNumber';
import { Menu } from 'lucide-react';
import Swal from 'sweetalert2';
import socket from '../../socket'; // 📌 Import socket เข้ามาใช้งาน

export default function UserHistory() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);
  
  // 📌 State สำหรับการแบ่งหน้า
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const user = JSON.parse(localStorage.getItem('user')) || {};

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!filterMenuRef.current?.contains(event.target)) {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

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
      const userId = user._id || user.id;

      if (!userId) {
        console.error("ไม่พบข้อมูล User ID");
        setIsLoading(false);
        return;
      }

      const res = await API.get(`/borrows/user/${userId}`);
      
      const data = Array.isArray(res.data) ? res.data : [];
      const sortedData = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setHistory(sortedData);
    } catch (error) {
      console.error("Error fetching history:", error);
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

  const isOverdue = (record) =>
    record.status === 'approved' && record.dueDate && new Date(record.dueDate) < new Date();

  const statusFilters = [
    { key: 'all', label: 'ทั้งหมด', count: history.length },
    { key: 'approved', label: 'กำลังยืมอยู่', count: history.filter(record => record.status === 'approved' && !isOverdue(record)).length },
    { key: 'pending', label: 'รออนุมัติ', count: history.filter(record => record.status === 'pending').length },
    { key: 'overdue', label: 'เลยกำหนด', count: history.filter(isOverdue).length },
    { key: 'returned', label: 'คืนแล้ว', count: history.filter(record => record.status === 'returned').length },
    { key: 'rejected', label: 'ไม่อนุมัติ', count: history.filter(record => record.status === 'rejected').length },
  ];

  const filteredHistory = history.filter((record) => {
    const matchesSearch = record.item?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'overdue' && isOverdue(record))
      || (statusFilter === 'approved' && record.status === 'approved' && !isOverdue(record))
      || (['pending', 'returned', 'rejected'].includes(statusFilter) && record.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  // 📌 คำนวณข้อมูลสำหรับการแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) {
    return <LoadingState message="กำลังโหลดประวัติการยืม-คืน..." />;
  }

  return (
    <div className="relative flex min-h-125 flex-col gap-6">
      {/* ส่วนบน: หัวข้อและการค้นหา */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-md border border-black/10">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          📊 ประวัติการยืม-คืน
        </h2>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="ค้นหาชื่ออุปกรณ์..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // รีเซ็ตกลับไปหน้า 1 เสมอเมื่อมีการค้นหา
              }}
              className="w-full border border-black/10 pl-4 pr-10 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            />
            <span className="absolute right-3 top-2.5 text-gray-400 text-sm">🔍</span>
          </div>

          <div className="relative shrink-0" ref={filterMenuRef}>
            <button
              type="button"
              aria-label="กรองประวัติตามสถานะ"
              aria-haspopup="menu"
              aria-expanded={isFilterMenuOpen}
              onClick={() => setIsFilterMenuOpen((isOpen) => !isOpen)}
              className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold shadow-sm transition ${
                statusFilter !== 'all'
                  ? 'border-purple-700 bg-purple-700 text-white hover:bg-purple-800'
                  : 'border-black/10 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <Menu size={19} aria-hidden="true" />
              <span>{statusFilters.find((filter) => filter.key === statusFilter)?.label || 'ตัวกรอง'}</span>
            </button>

            {isFilterMenuOpen && (
              <div
                role="menu"
                aria-label="เลือกสถานะประวัติ"
                className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-black/10 bg-white p-2 shadow-xl"
              >
                {statusFilters.map((filter) => {
                  const isActive = statusFilter === filter.key;

                  return (
                    <button
                      key={filter.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      onClick={() => {
                        setStatusFilter(filter.key);
                        setCurrentPage(1);
                        setIsFilterMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                        isActive
                          ? 'bg-purple-700 text-white'
                          : 'text-gray-700 hover:bg-purple-50 hover:text-purple-800'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {formatNumber(filter.count)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
                    <td className="p-4 text-gray-600">{user.fullName || user.username || 'ฉัน'}</td>
                    <td className="p-4 text-center text-gray-600">{formatNumber(record.quantity)}</td>
                    
                    <td className="p-4 text-center text-gray-600">
                      {formatDate(record.borrowDate || record.createdAt)}
                    </td>
                    
                    <td className="p-4 text-center text-gray-600">
                      {record.status === 'pending' || record.status === 'rejected' 
                        ? '-' 
                        : formatDate(record.dueDate)}
                    </td>
                    
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
                    ไม่พบข้อมูลประวัติการยืม-คืนของคุณ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
      </div>

      {filteredHistory.length > 0 && (
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}