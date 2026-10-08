const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RegistrationRequest = require('../models/RegistrationRequest');

// 1. ลงทะเบียน (สมัครสมาชิกใหม่)
router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName } = req.body;

    if (!String(username || '').trim() || !String(password || '') || !String(fullName || '').trim()) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้ รหัสผ่าน และชื่อ-นามสกุลให้ครบ' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    }

    const normalizedUsername = String(username).trim();
    const normalizedFullName = String(fullName).trim();

    const [existingUser, existingRequest] = await Promise.all([
      User.findOne({ username: normalizedUsername }),
      RegistrationRequest.findOne({ username: normalizedUsername, status: 'pending' })
    ]);
    if (existingUser || existingRequest) {
      return res.status(400).json({ message: 'ชื่อผู้ใช้งานนี้มีอยู่ในระบบหรือกำลังรออนุมัติ' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const registrationRequest = new RegistrationRequest({
      username: normalizedUsername,
      password: hashedPassword,
      fullName: normalizedFullName
    });

    await registrationRequest.save();

    // 📡 ยิงสัญญาณ Real-time แจ้งแอดมินว่ามีสมาชิกสมัครเข้ามาใหม่
    if (req.io) {
      req.io.emit('users_updated');
    }

    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ รอการอนุมัติจากผู้ดูแลระบบ' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. เข้าสู่ระบบ (Login)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      const pendingRequest = await RegistrationRequest.exists({ username, status: 'pending' });
      if (pendingRequest) {
        return res.status(403).json({ message: 'บัญชีของคุณกำลังรอการอนุมัติจาก Admin' });
      }
      return res.status(400).json({ message: 'ไม่พบชื่อผู้ใช้งานนี้' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'รหัสผ่านไม่ถูกต้อง' });

    if (user.role !== 'admin' && user.status !== 'approved') {
      return res.status(403).json({ message: 'บัญชีของคุณยังไม่ได้รับการอนุมัติจาก Admin' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        department: user.department,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;