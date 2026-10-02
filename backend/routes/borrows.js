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

// ยื่นคำขอหลายรายการแบบ idempotent เพื่อให้ retry หลัง network error ไม่สร้างคำขอซ้ำ
router.post('/request-batch', protect, async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0 || requests.length > 100) {
      return res.status(400).json({ message: 'กรุณาส่งรายการอุปกรณ์ 1 ถึง 100 รายการ' });
    }

    const requestIds = new Set();
    const itemIds = new Set();

    for (const request of requests) {
      const quantity = Number(request.quantity);
      const days = Number(request.days);

      if (
        typeof request.requestId !== 'string' ||
        request.requestId.length < 8 ||
        request.requestId.length > 100 ||
        !/^[a-f\d]{24}$/i.test(String(request.itemId)) ||
        !Number.isInteger(quantity) || quantity < 1 ||
        !Number.isInteger(days) || days < 1
      ) {
        return res.status(400).json({ message: 'ข้อมูลคำขอยืมไม่ถูกต้อง' });
      }

      if (requestIds.has(request.requestId) || itemIds.has(String(request.itemId))) {
        return res.status(400).json({ message: 'มีรายการซ้ำในตะกร้า กรุณาตรวจสอบก่อนส่ง' });
      }

      requestIds.add(request.requestId);
      itemIds.add(String(request.itemId));
    }

    const requestedById = new Map(requests.map(request => [request.requestId, request]));
    const existingRequests = await Borrow.find({
      user: req.user._id,
      requestId: { $in: [...requestIds] }
    });

    for (const existing of existingRequests) {
      const requested = requestedById.get(existing.requestId);
      if (
        !requested ||
        String(existing.item) !== String(requested.itemId) ||
        existing.quantity !== Number(requested.quantity) ||
        existing.days !== Number(requested.days)
      ) {
        return res.status(409).json({
          message: 'พบคำขอเดิมที่ใช้รหัสเดียวกันแต่ข้อมูลต่างกัน กรุณาโหลดหน้าใหม่และตรวจสอบประวัติ'
        });
      }
    }

    const existingRequestIds = new Set(existingRequests.map(request => request.requestId));
    const newRequests = requests.filter(request => !existingRequestIds.has(request.requestId));

    if (newRequests.length > 0) {
      const currentItems = await Item.find({
        _id: { $in: newRequests.map(request => request.itemId) }
      });
      const currentItemsById = new Map(currentItems.map(item => [String(item._id), item]));

      for (const request of newRequests) {
        const item = currentItemsById.get(String(request.itemId));
        if (!item) return res.status(404).json({ message: 'ไม่พบอุปกรณ์บางรายการในตะกร้า' });
        if (item.quantity < Number(request.quantity)) {
          return res.status(400).json({
            message: `อุปกรณ์ "${item.name}" เหลือ ${item.quantity} ชิ้น ไม่เพียงพอกับจำนวนที่ขอ`
          });
        }
      }

      try {
        await Borrow.bulkWrite(newRequests.map(request => ({
          updateOne: {
            filter: { user: req.user._id, requestId: request.requestId },
            update: {
              $setOnInsert: {
                user: req.user._id,
                item: request.itemId,
                requestId: request.requestId,
                quantity: Number(request.quantity),
                days: Number(request.days),
                status: 'pending',
                borrowDate: new Date()
              }
            },
            upsert: true
          }
        })), { ordered: true });
      } catch (error) {
        // Concurrent retries can race on the unique idempotency index; re-read below.
        if (error.code !== 11000) throw error;
      }
    }

    const savedRequests = await Borrow.find({
      user: req.user._id,
      requestId: { $in: [...requestIds] }
    });

    if (savedRequests.length !== requests.length) {
      return res.status(500).json({ message: 'บันทึกคำขอได้ไม่ครบ กรุณาส่งรายการเดิมซ้ำอีกครั้ง' });
    }

    for (const saved of savedRequests) {
      const requested = requestedById.get(saved.requestId);
      if (
        String(saved.item) !== String(requested.itemId) ||
        saved.quantity !== Number(requested.quantity) ||
        saved.days !== Number(requested.days)
      ) {
        return res.status(409).json({ message: 'คำขอบางรายการมีข้อมูลไม่ตรงกับ draft ปัจจุบัน' });
      }
    }

    if (newRequests.length > 0 && req.io) {
      req.io.emit('borrow_updated');
      req.io.emit('borrowsUpdated');
    }

    res.status(existingRequests.length === requests.length ? 200 : 201).json({
      message: 'ส่งคำร้องขอยืมเรียบร้อยแล้ว',
      borrows: savedRequests
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการส่งคำร้องแบบชุด:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งคำร้อง กรุณาลองส่งรายการเดิมอีกครั้ง' });
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