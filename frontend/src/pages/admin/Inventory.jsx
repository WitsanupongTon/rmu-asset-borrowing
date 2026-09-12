import { useState, useEffect } from "react";
import API from "../../api/axios";
import Swal from "sweetalert2";
import socket from "../../socket"; // 📌 นำเข้า Socket Instance จากไฟล์กลางแทนการ new io() ใหม่
import LoadingState from "../../components/LoadingState";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [expandedItems, setExpandedItems] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    category: "",
    quantity: "",
    description: "",
    image: "",
  });

  useEffect(() => {
    fetchItems();

    // ⚡ เชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ
    if (!socket.connected) {
      socket.connect();
    }

    const handleItemsUpdated = () => {
      fetchItems();
      Swal.fire({
        icon: "info",
        title: "คลังอุปกรณ์มีการอัปเดต",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    };

    // ⚡ ดักรับ Event จาก Backend
    socket.on("itemsUpdated", handleItemsUpdated);

    // ⚡ ถอด Event Listener ออกเมื่อ Unmount (ไม่ใช้ socket.disconnect() เพื่อป้องกัน Warning)
    return () => {
      socket.off("itemsUpdated", handleItemsUpdated);
    };
  }, []);

  const fetchItems = async () => {
    try {
      const res = await API.get("/items");
      setItems(res.data);
    } catch (err) {
      console.error("Error fetching items", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setIsEditing(true);
      setFormData({
        _id: item._id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        description: item.description || "",
        image: item.image || "",
      });
    } else {
      setIsEditing(false);
      setFormData({
        _id: "",
        name: "",
        category: "",
        quantity: "",
        description: "",
        image: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        Swal.fire(
          "คำเตือน",
          "ขนาดไฟล์รูปภาพต้องไม่เกิน 1MB กรุณาเลือกรูปที่ขนาดเล็กกว่านี้",
          "warning"
        );
        e.target.value = null;
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await API.put(`/items/${formData._id}`, formData);
        Swal.fire({
          icon: "success",
          title: "อัปเดตอุปกรณ์สำเร็จ",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const payload = { ...formData };
        delete payload._id;

        await API.post("/items", payload);
        Swal.fire({
          icon: "success",
          title: "เพิ่มอุปกรณ์สำเร็จ",
          timer: 1500,
          showConfirmButton: false,
        });
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || "บันทึกข้อมูลไม่สำเร็จ";
      Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: errorMsg });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "ยืนยันการลบ?",
      text: "ข้อมูลอุปกรณ์นี้จะถูกลบออกจากคลัง",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "ลบเลย",
      cancelButtonText: "ยกเลิก",
    });

    if (result.isConfirmed) {
      try {
        await API.delete(`/items/${id}`);
        Swal.fire({
          icon: "success",
          title: "ลบสำเร็จ!",
          timer: 1500,
          showConfirmButton: false,
        });
        fetchItems();
      } catch (err) {
        Swal.fire("ผิดพลาด", "ไม่สามารถลบอุปกรณ์นี้ได้", "error");
      }
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) {
    return <LoadingState message="กำลังโหลดข้อมูลคลังอุปกรณ์..." />;
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-md border border-black/10">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          📦 จัดการคลังอุปกรณ์
        </h2>
        <div className="flex gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="ค้นหาชื่อ, หมวดหมู่..."
            className="border border-black/10 p-2 rounded-lg w-full md:w-64 text-sm focus:ring-2 focus:ring-purple-400 outline-none"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          <button
            onClick={() => handleOpenModal()}
            className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition shadow cursor-pointer"
          >
            + เพิ่มอุปกรณ์
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 shadow-md bg-white flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-black/10 text-gray-700 text-sm font-semibold">
                <th className="p-4">รูปภาพ</th>
                <th className="p-4">ชื่ออุปกรณ์</th>
                <th className="p-4">หมวดหมู่</th>
                <th className="p-4">จำนวน</th>
                <th className="p-4">คำอธิบาย</th>
                <th className="p-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <tr
                    key={item._id}
                    className="border-b border-black/10 bg-white hover:bg-gray-50 text-sm align-top"
                  >
                    <td className="p-4">
                      <img
                        src={
                          item.image || "https://placehold.co/150?text=No+Image"
                        }
                        alt={item.name || "Equipment"}
                        className="w-16 h-16 object-cover rounded border border-black/10"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://placehold.co/150?text=No+Image";
                        }}
                      />
                    </td>
                    <td className="p-4 font-semibold text-gray-800">
                      {item.name}
                    </td>
                    <td className="p-4 text-gray-600">{item.category}</td>
                    <td className="p-4 font-bold text-purple-700">
                      {item.quantity}
                    </td>
                    <td className="p-4 text-xs text-gray-600 max-w-xs whitespace-normal">
                      {item.description ? (
                        item.description.length > 40 ? (
                          <div>
                            <p className="wrap-break-word">
                              {expandedItems[item._id]
                                ? item.description
                                : `${item.description.slice(0, 40)}...`}
                            </p>
                            <button
                              type="button"
                              onClick={() => toggleExpand(item._id)}
                              className="text-purple-600 font-semibold hover:underline text-[11px] mt-1 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {expandedItems[item._id]
                                ? "▲ แสดงน้อยลง"
                                : "▼ อ่านเพิ่มเติม"}
                            </button>
                          </div>
                        ) : (
                          item.description
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(item)}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm cursor-pointer"
                        >
                          ✏️ แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(item._id)}
                          className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm cursor-pointer"
                        >
                          🗑️ ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-gray-400">
                    ไม่พบข้อมูลอุปกรณ์ในคลัง
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredItems.length > 0 && (
          <div className="flex justify-between items-center p-4 bg-gray-50 border-t border-black/10 rounded-b-xl">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                currentPage === 1
                  ? "bg-gray-200 text-gray-400 cursor-default opacity-60"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 shadow-sm cursor-pointer"
              }`}
            >
              ◀ ก่อนหน้า
            </button>

            <span className="text-sm text-gray-600 font-medium">
              หน้า {currentPage} จาก {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                currentPage === totalPages
                  ? "bg-gray-200 text-gray-400 cursor-default opacity-60"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 shadow-sm cursor-pointer"
              }`}
            >
              ถัดไป ▶
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-black/10">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {isEditing ? "✏️ แก้ไขอุปกรณ์" : "📦 เพิ่มอุปกรณ์ใหม่"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  ชื่ออุปกรณ์
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-black/10 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  หมวดหมู่
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-black/10 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  จำนวน
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full border border-black/10 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  เลือกรูปภาพอุปกรณ์ (จากเครื่อง)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                />
                {formData.image && (
                  <div className="mt-2 flex items-center gap-3 border border-black/10 p-2 rounded-lg bg-gray-50">
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded-lg border border-black/10"
                    />
                    <span className="text-xs text-green-600 font-medium">
                      ✓ เลือกรูปภาพแล้ว
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  rows="3"
                  className="w-full border border-black/10 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition shadow-md cursor-pointer"
                >
                  {isEditing ? "บันทึกการแก้ไข" : "บันทึกอุปกรณ์"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}