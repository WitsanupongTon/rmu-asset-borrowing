const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');

// 1. ดึงข้อมูลอุปกรณ์ทั้งหมด (User และ Admin ดูได้)
router.get('/', protect, async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items' });
  }
});

// 2. เพิ่มอุปกรณ์ใหม่ (เฉพาะ Admin)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const newItem = await Item.create(req.body);

    // 📡 ยิงสัญญาณ Real-time บอกฝั่ง Frontend ว่ามีอุปกรณ์เพิ่มขึ้นมาใหม่
    if (req.io) {
      req.io.emit('inventory_updated');
      req.io.emit('itemsUpdated');
    }

    res.status(201).json(newItem);
  } catch (error) {
    console.error("🔥 พบปัญหาตอนเพิ่มอุปกรณ์:", error);
    res.status(500).json({ message: error.message || 'Error creating item' });
  }
});

// 3. แก้ไขอุปกรณ์
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after' }
    );
    if (!updatedItem) {
      return res.status(404).json({ message: 'ไม่พบอุปกรณ์นี้' });
    }

    // 📡 ยิงสัญญาณ Real-time บอกฝั่ง Frontend
    if (req.io) {
      req.io.emit('inventory_updated');
      req.io.emit('itemsUpdated');
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Error updating item' });
  }
});

// 4. ลบอุปกรณ์ (เฉพาะ Admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);

    // 📡 ยิงสัญญาณ Real-time บอกฝั่ง Frontend
    if (req.io) {
      req.io.emit('inventory_updated');
      req.io.emit('itemsUpdated');
    }

    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item' });
  }
});

module.exports = router;