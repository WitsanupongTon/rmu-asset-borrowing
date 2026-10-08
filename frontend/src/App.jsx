import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';

// 📌 Layouts
import AdminLayout from './layouts/AdminLayout';
import UserLayout from './layouts/UserLayout';
import ProtectedRoute from './components/ProtectedRoute';

// 📌 Component ฝั่ง User
import UserHistory from './pages/user/UserHistory'; // 👈 1. นำเข้า UserHistory

// Component สำหรับยืมพัสดุ (ใช้ตัวเดียวกันทั้ง Admin และ User)
import BorrowEquipment from './pages/admin/BorrowEquipment';

// 📌 Components ฝั่ง Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import Users from './pages/admin/Users';
import ApproveUsers from './pages/admin/ApproveUsers'; 
import Inventory from './pages/admin/Inventory';
import AdminBorrowRequests from './pages/admin/AdminBorrowRequests';
import AdminReturns from './pages/admin/AdminReturns';
import AdminHistory from './pages/admin/AdminHistory';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* ================= ROUTE สำหรับ USER (ใช้ UserLayout) ================= */}
        <Route 
          element={
            <ProtectedRoute allowedRole="user">
              <UserLayout />
            </ProtectedRoute>
          } 
        >
          <Route path="/dashboard" element={<Navigate to="/borrow" replace />} />
          <Route path="/borrow" element={<BorrowEquipment />} />
          <Route path="/history" element={<UserHistory />} /> {/* 👈 2. เพิ่ม Route สำหรับดูประวัติ */}
        </Route>
        
        {/* ================= ROUTE สำหรับ ADMIN ================= */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="borrow" element={<BorrowEquipment />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="users" element={<Users />} />
          <Route path="approve-users" element={<ApproveUsers />} />
          <Route path="borrow-requests" element={<AdminBorrowRequests />} />
          <Route path="returns" element={<AdminReturns />} />
          <Route path="history" element={<AdminHistory />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;