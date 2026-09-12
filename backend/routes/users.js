const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// 1. ดึงข้อมูลผู้ใช้ทั้งหมด (เฉพาะ Admin)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
  }
});

// 2. แอดมินเพิ่มผู้ใช้ใหม่ (เฉพาะ Admin)
router.post('/add', protect, adminOnly, async (req, res) => {
  try {
    const { username, password, fullName, department, role, status } = req.body;
    const userExists = await User.findOne({ username });
    
    if (userExists) return res.status(400).json({ message: 'มีชื่อผู้ใช้นี้ในระบบแล้ว' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      fullName,
      department: department || '-',
      role,
      status
    });

    // 📡 ยิงสัญญาณ Real-time
    if (req.io) req.io.emit('users_updated');

    res.status(201).json({ message: 'สร้างผู้ใช้สำเร็จ' });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' });
  }
});

// 3. แก้ไขข้อมูลผู้ใช้ (รวมถึงเปลี่ยนสถานะและบทบาท)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { fullName, role, status, department } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { fullName, role, status, department },
      { returnDocument: 'after' }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้นี้' });
    }

    // 📡 ยิงสัญญาณ Real-time
    if (req.io) req.io.emit('users_updated');

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
  }
});

// 4. ลบผู้ใช้
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้นี้' });
    }

    // 📡 ยิงสัญญาณ Real-time
    if (req.io) req.io.emit('users_updated');

    res.json({ message: 'ลบผู้ใช้สำเร็จ' });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบ' });
  }
});

// ดึงรายชื่อผู้ใช้ที่รอการอนุมัติ (เฉพาะ Admin)
router.get('/pending', protect, adminOnly, async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' }).select('-password');
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

// เปลี่ยนสถานะอนุมัติสมาชิก (เฉพาะ Admin)
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body; 
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after' }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้นี้' });
    }

    // 📡 ยิงสัญญาณ Real-time
    if (req.io) req.io.emit('users_updated');
    
    res.json({ message: 'อัปเดตสถานะสำเร็จ', user });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดต' });
  }
});

module.exports = router;