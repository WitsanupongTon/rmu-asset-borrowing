const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware ตรวจสอบการเข้าสู่ระบบผ่าน Token
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'ไม่พบผู้ใช้ในระบบ' });
      }
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
  }
};

// Middleware ตรวจสอบสิทธิ์ Admin
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'สิทธิ์ไม่ถูกต้อง (สำหรับผู้ดูแลระบบเท่านั้น)' });
  }
};

module.exports = { protect, adminOnly };