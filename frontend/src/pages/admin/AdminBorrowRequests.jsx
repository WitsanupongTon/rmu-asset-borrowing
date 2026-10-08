import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingState from '../../components/LoadingState';
import PaginationBar from '../../components/PaginationBar';
import Swal from 'sweetalert2';
import socket from '../../socket';
import formatNumber from '../../utils/formatNumber';

export default function AdminBorrowRequests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 📌 State สำหรับการแบ่งหน้า
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchRequests();

    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักรับ Event เมื่อมีการอัปเดตข้อมูลพัสดุหรือคำร้อง
    const handleItemsUpdated = () => {
      fetchRequests();
      
      // แสดง Toast แจ้งเตือนมุมขวาบน
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'มีการอัปเดตข้อมูลรายการยืม/พัสดุ!',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    };

    // ⚡ ผูก Event Listener (ใช้ event ชื่อ itemsUpdated ตาม Backend)
    socket.on('itemsUpdated', handleItemsUpdated);

    // คืนค่าเพื่อลบ Event Listener เฉพาะตัวเมื่อ Component Unmount
    return () => {
      socket.off('itemsUpdated', handleItemsUpdated);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await API.get('/borrows/admin/all');
      setRequests(res.data);
    } catch (error) {
      console.error("Error fetching requests", error);
      Swal.fire('ผิดพลาด', 'ไม่สามารถดึงข้อมูลคำร้องได้', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (req, status, defaultDays = 7) => {
    if (status === 'approved') {
      const availableQuantity = req.item?.quantity ?? 0;
      const requestedQuantity = req.quantity ?? 0;

      // ตรวจสอบ stock พัสดุก่อนอนุมัติ
      if (availableQuantity < requestedQuantity) {
        Swal.fire({
          icon: 'error',
          title: 'พัสดุไม่เพียงพอ',
          text: `ไม่สามารถอนุมัติได้ เนื่องจากพัสดุในคลังเหลือ ${formatNumber(availableQuantity)} ชิ้น (คำร้องขอ ${formatNumber(requestedQuantity)} ชิ้น)`,
          confirmButtonColor: '#ef4444',
          confirmButtonText: 'ตกลง'
        });
        return;
      }

      const confirm = await Swal.fire({
        title: 'ยืนยันการอนุมัติ?',
        text: `ยืนยันการอนุมัติให้ยืมพัสดุเป็นเวลา ${formatNumber(defaultDays)} วัน`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '✓ อนุมัติ',
        cancelButtonText: 'ยกเลิก'
      });

      if (confirm.isConfirmed) {
        try {
          await API.put(`/borrows/${req._id}/status`, { status, days: Number(defaultDays) });
          Swal.fire('สำเร็จ', 'ดำเนินการอนุมัติเรียบร้อยแล้ว', 'success');
          fetchRequests(); // 🔄 โหลดข้อมูลใหม่ทันทีสำหรับแอดมินคนที่กด
        } catch (error) {
          Swal.fire('ผิดพลาด', error.response?.data?.message || 'เกิดข้อผิดพลาดในการอัปเดต', 'error');
        }
      }
    } else {
      const confirm = await Swal.fire({
        title: 'ยืนยันการไม่อนุมัติ?',
        text: "คำร้องนี้จะถูกปฏิเสธทันที",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'ใช่, ไม่อนุมัติ',
        cancelButtonText: 'ยกเลิก'
      });

      if (confirm.isConfirmed) {
        try {
          await API.put(`/borrows/${req._id}/status`, { status });
          Swal.fire('สำเร็จ', 'ดำเนินการไม่อนุมัติเรียบร้อยแล้ว', 'success');
          fetchRequests(); // 🔄 โหลดข้อมูลใหม่ทันทีสำหรับแอดมินคนที่กด
        } catch (error) {
          Swal.fire('ผิดพลาด', error.response?.data?.message || 'เกิดข้อผิดพลาดในการอัปเดต', 'error');
        }
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric' 
    });
  };

  const pendingRequests = requests.filter(req => 
    req.status === 'pending' &&
    (req.item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     req.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 📌 คำนวณข้อมูลสำหรับการแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(pendingRequests.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = pendingRequests.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) {
    return <LoadingState message="กำลังโหลดคำร้องขอยืม..." />;
  }

  return (
    <div className="relative flex min-h-125 flex-col gap-6 text-base">
      {/* ส่วนบน: หัวข้อและการค้นหา */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-md border border-black/10">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          📋 คำร้องขอยืมพัสดุ (รอพิจารณา)
        </h2>
        <div className="relative w-full md:w-80">
          <input 
            type="text" 
            placeholder="ค้นหาผู้ขอยืม หรือ ชื่อพัสดุ..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
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
              <tr className="bg-purple-50 text-purple-800 text-base font-semibold border-b border-black/10">
                <th className="p-4">รูปภาพ</th>
                <th className="p-4">พัสดุ</th>
                <th className="p-4">ผู้ขอยืม</th>
                <th className="p-4 text-center">จำนวน</th>
                <th className="p-4 text-center">ระยะเวลา</th>
                <th className="p-4 text-center">วันที่ขอ</th>
                <th className="p-4 text-center">สถานะ</th>
                <th className="p-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((req) => (
                  <tr key={req._id} className="border-b border-black/10 hover:bg-gray-50 transition text-base">
                    <td className="p-4">
                      <img 
                        src={req.item?.image || "https://placehold.co/150"} 
                        alt={req.item?.name} 
                        className="w-12 h-12 object-cover rounded-lg border border-black/10"
                      />
                    </td>
                    <td className="p-4 font-medium text-gray-800">{req.item?.name || 'ไม่พบพัสดุ'}</td>
                    <td className="p-4 text-gray-600">{req.user?.username || req.user?.name || 'ไม่ระบุตัวตน'}</td>
                    <td className="p-4 text-center text-gray-700">{formatNumber(req.quantity)}</td>
                    <td className="p-4 text-center text-gray-700">{formatNumber(req.days || 7)} วัน</td>
                    <td className="p-4 text-center text-gray-600">{formatDate(req.borrowDate || req.createdAt)}</td>
                    
                    <td className="p-4 text-center">
                      <span className="bg-yellow-100 text-yellow-700 font-bold px-3 py-1 rounded-full text-xs">
                        รออนุมัติ
                      </span>
                    </td>
                    
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleUpdateStatus(req, 'approved', req.days)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          ✓ อนุมัติ
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(req, 'rejected')}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          ✕ ไม่อนุมัติ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center p-8 text-gray-500 text-sm">
                    ไม่มีคำร้องขอยืมที่รอพิจารณาในขณะนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {pendingRequests.length > 0 && (
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}