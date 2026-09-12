import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingState from '../../components/LoadingState';
import Swal from 'sweetalert2';
import socket from '../../socket'; // 📌 Import socket เข้ามาใช้งาน

export default function AdminReturns() {
  const [borrows, setBorrows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 📌 State สำหรับการแบ่งหน้า
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchBorrows();

    // ⚡ เชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักฟังเมื่อมีการอัปเดตรายการยืม/คืน
    const handleBorrowsUpdated = () => {
      fetchBorrows();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'มีการอัปเดตรายการยืม/คืน!',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    };

    // ⚡ ผูก Event Listeners (รองรับหลายชื่อ event จาก backend)
    socket.on('borrow_updated', handleBorrowsUpdated);
    socket.on('borrowsUpdated', handleBorrowsUpdated);
    socket.on('itemsUpdated', handleBorrowsUpdated);

    // ⚡ ถอด Event Listeners เฉพาะตัวออกเมื่อ Unmount
    return () => {
      socket.off('borrow_updated', handleBorrowsUpdated);
      socket.off('borrowsUpdated', handleBorrowsUpdated);
      socket.off('itemsUpdated', handleBorrowsUpdated);
    };
  }, []);

  const fetchBorrows = async () => {
    try {
      const res = await API.get('/borrows/admin/all');
      setBorrows(res.data);
    } catch (error) {
      console.error("Error fetching borrows", error);
      Swal.fire('ผิดพลาด', 'ไม่สามารถดึงข้อมูลรายการยืมได้', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturn = async (id, itemName) => {
    const confirm = await Swal.fire({
      title: 'ยืนยันการรับคืน?',
      text: `ตรวจสอบแล้วรับ "${itemName}" คืนเข้าคลังใช่หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'รับคืน',
      cancelButtonText: 'ยกเลิก'
    });

    if (confirm.isConfirmed) {
      try {
        await API.put(`/borrows/${id}/return`);
        Swal.fire('สำเร็จ', 'รับอุปกรณ์คืนและอัปเดตคลังเรียบร้อยแล้ว', 'success');
        fetchBorrows(); 
      } catch (error) {
        Swal.fire('ผิดพลาด', error.response?.data?.message || 'เกิดข้อผิดพลาดในการรับคืน', 'error');
      }
    }
  };

  const getDueDate = (startDate, days) => {
    if (!startDate) return new Date();
    const date = new Date(startDate);
    date.setDate(date.getDate() + (days || 7)); 
    return date;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const activeBorrows = borrows.filter(b => 
    b.status === 'approved' &&
    (b.item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     b.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 📌 คำนวณข้อมูลสำหรับการแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(activeBorrows.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = activeBorrows.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) {
    return <LoadingState message="กำลังโหลดรายการรอคืน..." />;
  }

  return (
    <div className="space-y-6 relative">
      {/* ส่วนบน: หัวข้อและการค้นหา */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-md border border-black/10">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          🕹️ จัดการการคืน
        </h2>
        <div className="relative w-full md:w-80">
          <input 
            type="text" 
            placeholder="ค้นหาผู้ยืม หรือ อุปกรณ์..."
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

      {/* ส่วนล่าง: ตารางข้อมูลพร้อมแบ่งหน้า */}
      <div className="rounded-xl border border-black/10 shadow-md bg-white flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-150">
            <thead>
              <tr className="bg-purple-50 text-purple-800 text-sm font-semibold border-b border-black/10">
                <th className="p-4">รูปภาพ</th>
                <th className="p-4">อุปกรณ์</th>
                <th className="p-4">ผู้ยืม</th>
                <th className="p-4 text-center">จำนวน</th>
                <th className="p-4 text-center">วันที่อนุมัติ</th>
                <th className="p-4 text-center">กำหนดคืน</th>
                <th className="p-4 text-center">สถานะ</th>
                <th className="p-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((borrow) => {
                  const approvalDate = borrow.updatedAt || borrow.borrowDate;
                  const dueDate = borrow.dueDate ? new Date(borrow.dueDate) : getDueDate(approvalDate, borrow.days);
                  const isOverdue = new Date() > dueDate; 

                  const rowClass = isOverdue ? "border-b border-black/10 bg-red-50 hover:bg-red-100 transition text-sm" : "border-b border-black/10 hover:bg-gray-50 transition text-sm";
                  const normalText = isOverdue ? "text-red-600" : "text-gray-600";
                  const boldText = isOverdue ? "text-red-700 font-medium" : "text-gray-800 font-medium";

                  return (
                    <tr key={borrow._id} className={rowClass}>
                      <td className="p-4">
                        <img 
                          src={borrow.item?.image || "https://placehold.co/150"} 
                          alt={borrow.item?.name} 
                          className={`w-12 h-12 object-cover rounded-lg border border-black/10 ${isOverdue ? 'border-red-300' : ''}`}
                        />
                      </td>
                      <td className={`p-4 ${boldText}`}>{borrow.item?.name || 'ไม่พบอุปกรณ์'}</td>
                      <td className={`p-4 ${normalText}`}>{borrow.user?.username || borrow.user?.name || 'ไม่ระบุตัวตน'}</td>
                      <td className={`p-4 text-center ${normalText}`}>{borrow.quantity}</td>
                      
                      <td className={`p-4 text-center ${normalText}`}>{formatDate(approvalDate)}</td>
                      <td className={`p-4 text-center ${normalText}`}>{formatDate(dueDate)}</td>
                      
                      <td className="p-4 text-center">
                        {isOverdue ? (
                          <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-xs">
                            เลยกำหนด
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full text-xs">
                            กำลังยืม
                          </span>
                        )}
                      </td>
                      
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleReturn(borrow._id, borrow.item?.name)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
                        >
                          รับคืน
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="text-center p-8 text-gray-500 text-sm">
                    ไม่มีรายการที่กำลังยืมอยู่ในขณะนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ส่วนแบ่งหน้า (Pagination) */}
        {activeBorrows.length > 0 && (
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