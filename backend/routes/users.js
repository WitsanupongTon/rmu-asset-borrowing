const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const User = require('../models/User');
const RegistrationRequest = require('../models/RegistrationRequest');
const { protect, adminOnly } = require('../middleware/auth');

// 1. ดึงข้อมูลผู้ใช้ทั้งหมด (เฉพาะ Admin)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({
      $or: [{ role: 'admin' }, { status: 'approved' }]
    }).select('-password').sort({ createdAt: -1 });
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
      status: status || 'approved'
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
    const [pendingUsers, pendingRequests] = await Promise.all([
      User.find({ status: 'pending' }).select('-password').lean(),
      RegistrationRequest.find({ status: 'pending' }).select('-password').lean()
    ]);

    const results = [
      ...pendingUsers.map(user => ({ ...user, requestType: 'legacy-user' })),
      ...pendingRequests.map(request => ({ ...request, requestType: 'registration' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

// เปลี่ยนสถานะอนุมัติสมาชิก (เฉพาะ Admin)
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body; 
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'สถานะที่ระบุไม่ถูกต้อง' });
    }

    const registrationRequest = await RegistrationRequest.findOne({
      _id: req.params.id,
      status: 'pending'
    });

    if (registrationRequest) {
      let createdUser = null;

      if (status === 'approved') {
        const existingUser = await User.findOne({ username: registrationRequest.username });
        if (existingUser) {
          return res.status(409).json({ message: 'ชื่อผู้ใช้นี้มีบัญชีอยู่แล้ว ไม่สามารถอนุมัติซ้ำได้' });
        }

        createdUser = await User.create({
          username: registrationRequest.username,
          password: registrationRequest.password,
          fullName: registrationRequest.fullName,
          department: registrationRequest.department || '-',
          role: 'user',
          status: 'approved'
        });
      }

      const requestUpdate = await RegistrationRequest.updateOne(
        { _id: registrationRequest._id, status: 'pending' },
        {
          $set: { status },
          $unset: { password: '' }
        }
      );

      if (requestUpdate.modifiedCount !== 1) {
        if (createdUser) await User.findByIdAndDelete(createdUser._id);
        return res.status(409).json({ message: 'คำขอนี้ถูกดำเนินการไปแล้ว' });
      }

      if (req.io) {
        req.io.emit('users_updated');
      }

      return res.json({
        message: status === 'approved' ? 'อนุมัติและสร้างบัญชีผู้ใช้สำเร็จ' : 'ปฏิเสธคำขอสมัครสมาชิกแล้ว',
        user: createdUser ? createdUser.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } }) : null
      });
    }

    // รองรับบัญชี pending ที่ถูกสร้างไว้ก่อนแยก RegistrationRequest
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after' }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'ไม่พบคำขอหรือผู้ใช้นี้' });

    // 📡 ยิงสัญญาณ Real-time
    if (req.io) req.io.emit('users_updated');
    
    res.json({ message: 'อัปเดตสถานะสำเร็จ', user });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดต' });
  }
});

module.exports = router;