import { useState, useEffect } from 'react';
import API from '../../api/axios';
import Swal from 'sweetalert2';
import socket from '../../socket'; // 📌 นำเข้า Socket Instance ส่วนกลาง

export default function BorrowEquipment() {
  const [items, setItems] = useState([]);
  const user = JSON.parse(localStorage.getItem('user'));

  const [expandedItems, setExpandedItems] = useState({});
  const [cart, setCart] = useState([]); 
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  
  const [activeItem, setActiveItem] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalDays, setModalDays] = useState(7);
  const [isCustomDays, setIsCustomDays] = useState(false);

  useEffect(() => {
    fetchItems();

    // ⚡ เชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักรับ Event เมื่อข้อมูลอุปกรณ์มีการอัปเดต
    const handleItemsUpdated = () => {
      fetchItems();

      Swal.fire({
        icon: 'info',
        title: 'ข้อมูลอุปกรณ์อัปเดตแล้ว',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    };

    // ⚡ ผูก Event Listener
    socket.on('itemsUpdated', handleItemsUpdated);

    // ⚡ ถอด Event Listener ออกเมื่อ Unmount (ไม่ใช้ socket.disconnect())
    return () => {
      socket.off('itemsUpdated', handleItemsUpdated);
    };
  }, []);

  const fetchItems = async () => {
    try {
      const res = await API.get('/items');
      setItems(res.data);
    } catch (error) {
      console.error("Error fetching items", error);
    }
  };

  const toggleExpand = (id) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openItemModal = (item) => {
    if (cart.find((c) => c._id === item._id)) {
      Swal.fire('แจ้งเตือน', 'อุปกรณ์นี้อยู่ในรายการแล้ว', 'info');
      return;
    }
    setActiveItem(item);
    setModalQty(1);
    setModalDays(7);
    setIsCustomDays(false); 
  };

  const confirmAddToCart = () => {
    if (modalQty > activeItem.quantity || modalQty < 1) {
      Swal.fire('ผิดพลาด', `ระบุจำนวนไม่ถูกต้อง (เหลือ ${activeItem.quantity} ชิ้น)`, 'error');
      return;
    }

    if (!modalDays || modalDays < 1) {
      Swal.fire('ผิดพลาด', 'กรุณาระบุจำนวนวันที่ต้องการยืมให้ถูกต้อง', 'error');
      return;
    }
    
    setCart([...cart, { ...activeItem, borrowQty: Number(modalQty), borrowDays: Number(modalDays) }]);
    setActiveItem(null); 
    
    Swal.fire({
      icon: 'success',
      title: `เพิ่ม ${activeItem.name} ลงรายการแล้ว`,
      timer: 1000,
      showConfirmButton: false,
    });
  };

  const handleRemoveFromCart = (id) => {
    const updatedCart = cart.filter(c => c._id !== id);
    setCart(updatedCart);
    if (updatedCart.length === 0) setIsCartModalOpen(false); 
  };

  const handleSubmitCart = async () => {
    try {
      const promises = cart.map(c => 
        API.post('/borrows/request', {
          itemId: c._id,
          quantity: c.borrowQty,
          days: c.borrowDays,
          userId: user?._id 
        })
      );

      await Promise.all(promises);

      Swal.fire('สำเร็จ!', 'ส่งคำร้องขอยืมอุปกรณ์ทั้งหมดเรียบร้อยแล้ว รอพิจารณา', 'success');
      setCart([]); 
      setIsCartModalOpen(false); 
      fetchItems(); 
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || 'ไม่สามารถส่งคำร้องได้', 'error');
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-md border border-black/10">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          🕹️ ยืมอุปกรณ์
        </h2>
        {cart.length > 0 && (
          <button 
            onClick={() => setIsCartModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            📋 รายการที่เลือก <span className="bg-white text-amber-600 px-2 py-0.5 rounded-full text-sm">{cart.length}</span>
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => {
          const isItemInCart = cart.find(c => c._id === item._id);
          const isOutOfStock = item.quantity <= 0;

          return (
            <div key={item._id} className="border border-black/10 rounded-xl p-4 shadow-md hover:shadow-lg transition bg-white flex flex-col h-full">
              <img 
                src={item.image || "https://placehold.co/150?text=No+Image"} 
                alt={item.name} 
                className="w-full h-48 object-cover rounded-lg mb-4 border border-black/10" 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://placehold.co/150?text=No+Image";
                }}
              />
              <h3 className="font-bold text-gray-800">{item.name}</h3>
              <p className="text-xs text-gray-500 mb-2">{item.category}</p>
              
              <div className="text-xs text-gray-500 grow mb-4">
                {item.description ? (
                  item.description.length > 80 ? (
                    <div>
                      <p className="wrap-break-word">
                        {expandedItems[item._id]
                          ? item.description
                          : `${item.description.slice(0, 80)}...`}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleExpand(item._id)}
                        className="text-purple-600 font-semibold hover:underline text-[11px] mt-1 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {expandedItems[item._id] ? "▲ แสดงน้อยลง" : "▼ อ่านเพิ่มเติม"}
                      </button>
                    </div>
                  ) : (
                    <p className="wrap-break-word">{item.description}</p>
                  )
                ) : (
                  "-"
                )}
              </div>

              <div className="mt-auto pt-4 border-t border-black/10 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">เหลือ {item.quantity}</span>
                <button 
                  onClick={() => openItemModal(item)}
                  disabled={isOutOfStock || isItemInCart}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition cursor-pointer ${
                    isItemInCart 
                      ? "bg-green-500 cursor-not-allowed" 
                      : !isOutOfStock 
                        ? "bg-purple-600 hover:bg-purple-700 shadow-sm" 
                        : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  {isItemInCart ? "✓ เลือกแล้ว" : "ขอยืม"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeItem && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col transform scale-100 border border-black/10">
            <div className="p-4 border-b border-black/10 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">ระบุรายละเอียดการยืม</h3>
              <p className="text-sm text-gray-500">{activeItem.name}</p>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนที่ต้องการ (เหลือ {activeItem.quantity})</label>
                <input 
                  type="number" 
                  min="1" 
                  max={activeItem.quantity}
                  value={modalQty}
                  onChange={(e) => setModalQty(e.target.value)}
                  className="w-full border border-black/10 p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลาการยืม (วัน)</label>
                <select 
                  value={isCustomDays ? 'custom' : modalDays}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomDays(true);
                      setModalDays('');
                    } else {
                      setIsCustomDays(false);
                      setModalDays(Number(e.target.value));
                    }
                  }}
                  className="w-full border border-black/10 p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-white cursor-pointer"
                >
                  <option value={7}>7 วัน (1 สัปดาห์)</option>
                  <option value={15}>15 วัน (ครึ่งเดือน)</option>
                  <option value={30}>30 วัน (1 เดือน)</option>
                  <option value="custom">ระบุวันเอง...</option>
                </select>

                {isCustomDays && (
                  <div className="mt-3 animate-fade-in">
                    <input 
                      type="number" 
                      min="1"
                      placeholder="พิมพ์จำนวนวันที่ต้องการ..."
                      value={modalDays}
                      onChange={(e) => setModalDays(e.target.value)}
                      className="w-full border border-black/10 p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-purple-50"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-black/10 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setActiveItem(null)} 
                className="px-4 py-2 rounded-lg text-gray-600 font-semibold hover:bg-gray-200 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                onClick={confirmAddToCart} 
                className="px-5 py-2 rounded-lg text-white font-semibold bg-purple-600 hover:bg-purple-700 shadow-md transition cursor-pointer"
              >
                เพิ่มลงรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {isCartModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-black/10">
            <div className="p-4 border-b border-black/10 bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">📋 สรุปรายการขอยืม</h3>
              <button onClick={() => setIsCartModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold text-xl cursor-pointer">&times;</button>
            </div>
            
            <div className="p-4 overflow-y-auto grow">
              <table className="w-full text-left border-collapse min-w-125">
                <thead>
                  <tr className="bg-purple-50 text-purple-800 text-sm border-b border-black/10">
                    <th className="p-3">รูปภาพ</th>
                    <th className="p-3">ชื่ออุปกรณ์</th>
                    <th className="p-3">จำนวน</th>
                    <th className="p-3">เวลา (วัน)</th>
                    <th className="p-3 text-center">ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(c => (
                    <tr key={c._id} className="border-b border-black/10 hover:bg-gray-50">
                      <td className="p-3">
                        <img src={c.image || "https://placehold.co/150"} alt={c.name} className="w-12 h-12 object-cover rounded border border-black/10" />
                      </td>
                      <td className="p-3 font-semibold text-gray-700">{c.name}</td>
                      <td className="p-3">{c.borrowQty}</td>
                      <td className="p-3">{c.borrowDays} วัน</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleRemoveFromCart(c._id)} className="text-rose-500 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded-lg cursor-pointer">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-black/10 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsCartModalOpen(false)} className="px-5 py-2 rounded-lg text-gray-600 font-semibold hover:bg-gray-200 transition cursor-pointer">
                กลับไปเลือกเพิ่ม
              </button>
              <button onClick={handleSubmitCart} className="px-6 py-2 rounded-lg text-white font-semibold bg-purple-600 hover:bg-purple-700 shadow-md transition cursor-pointer">
                🚀 ส่งคำร้องทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}