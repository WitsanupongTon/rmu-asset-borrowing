const express = require('express');
const router = express.Router();
const Borrow = require('../models/Borrow');
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');

// 1. ยื่นคำขอยืมพัสดุ
router.post('/request', protect, async (req, res) => {
  try {
    const { itemId, quantity, days } = req.body; 
    
    // เช็คสต๊อกก่อนให้ยืม
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: 'ไม่พบอุปกรณ์' });
    if (item.quantity < (quantity || 1)) {
      return res.status(400).json({ message: 'อุปกรณ์มีจำนวนไม่เพียงพอ' });
    }

    const borrow = new Borrow({
      user: req.user._id,
      item: itemId,
      quantity: quantity || 1,
      days: days || 7 
    });
    await borrow.save();

    // 📡 ยิงสัญญาณ Real-time แจ้งทุกฝั่ง (รวมถึง Layout & Dashboard)
    if (req.io) {
      req.io.emit('borrow_updated');
      req.io.emit('borrowsUpdated');
    }

    res.status(201).json(borrow);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยืม' });
  }
});

// 2. ประวัติการยืมของผู้ใช้ (ดึงผ่าน Token ของคนที่ล็อกอิน)
router.get('/my-history', protect, async (req, res) => {
  try {
    const history = await Borrow.find({ user: req.user._id }).populate('item');
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

// 3. ดูรายการยืมทั้งหมด (เฉพาะ Admin)
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const borrows = await Borrow.find().populate('user', '-password').populate('item');
    res.json(borrows);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

// 4. อนุมัติ / ปฏิเสธ คำขอยืม
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, days } = req.body;
    const borrow = await Borrow.findById(req.params.id);
    if (!borrow) return res.status(404).json({ message: 'ไม่พบรายการ' });

    if (status === 'approved') {
      // 🛑 ตรวจสอบจำนวนคงเหลือในคลังก่อนอนุมัติ
      const item = await Item.findById(borrow.item);
      if (!item || item.quantity < borrow.quantity) {
        return res.status(400).json({ message: 'อุปกรณ์ไม่เพียงพอ ไม่สามารถอนุมัติได้' });
      }

      const approvedDays = days || borrow.days || 7; 
      borrow.days = approvedDays; 

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + approvedDays); 
      borrow.dueDate = dueDate;

      await Item.findByIdAndUpdate(borrow.item, { 
        $inc: { quantity: -borrow.quantity } 
      });
    }

    borrow.status = status;
    await borrow.save();

    // 📡 ยิงสัญญาณ Real-time อัปเดตรายการยืมและจำนวนอุปกรณ์คงเหลือ
    if (req.io) {
      req.io.emit('borrow_updated');
      req.io.emit('borrowsUpdated');
      req.io.emit('inventory_updated');
      req.io.emit('itemsUpdated');
    }

    res.json(borrow);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดต' });
  }
});

// 5. รับคืนพัสดุ
router.put('/:id/return', protect, adminOnly, async (req, res) => {
  try {
    const borrow = await Borrow.findById(req.params.id);
    if (!borrow) return res.status(404).json({ message: 'ไม่พบรายการ' });

    borrow.status = 'returned';
    borrow.returnDate = new Date();
    await borrow.save();

    await Item.findByIdAndUpdate(borrow.item, { 
      $inc: { quantity: borrow.quantity } 
    });

    // 📡 ยิงสัญญาณ Real-time อัปเดตรายการคืนและคืนสต๊อกเข้าคลัง
    if (req.io) {
      req.io.emit('borrow_updated');
      req.io.emit('borrowsUpdated');
      req.io.emit('inventory_updated');
      req.io.emit('itemsUpdated');
    }

    res.json(borrow);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการคืน' });
  }
});

// 6. ดึงประวัติการยืมตาม User ID
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const history = await Borrow.find({ user: req.params.userId })
      .populate('item')
      .populate('user', '-password');
      
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ' });
  }
});

module.exports = router;