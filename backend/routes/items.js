const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');

const validateItemInput = (body, { partial = false } = {}) => {
  const errors = {};
  const name = typeof body.name === 'string' ? body.name.trim() : body.name;
  const category = typeof body.category === 'string' ? body.category.trim() : body.category;
  const quantity = Number(body.quantity);

  if (!partial || body.name !== undefined) {
    if (!name) errors.name = 'กรุณากรอกชื่อพัสดุ';
  }
  if (!partial || body.category !== undefined) {
    if (!category) errors.category = 'กรุณากรอกหมวดหมู่';
  }
  if (!partial || body.quantity !== undefined) {
    if (body.quantity === '' || body.quantity === null || body.quantity === undefined
      || !Number.isInteger(quantity) || quantity < 0) {
      errors.quantity = 'จำนวนพัสดุต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป';
    }
  }

  return { errors, name, category, quantity };
};

// 1. ดึงข้อมูลพัสดุทั้งหมด (User และ Admin ดูได้)
router.get('/', protect, async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items' });
  }
});

// 2. เพิ่มพัสดุใหม่ (เฉพาะ Admin)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { errors, name, category, quantity } = validateItemInput(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'กรุณาตรวจสอบข้อมูลพัสดุ', errors });
    }

    const newItem = await Item.create({
      ...req.body,
      name,
      category,
      quantity,
    });

    // 📡 แจ้ง client ว่ารายการพัสดุมีการเปลี่ยนแปลง
    if (req.io) {
      req.io.emit('inventory_updated');
      req.io.emit('itemsUpdated');
    }

    res.status(201).json(newItem);
  } catch (error) {
    console.error("🔥 พบปัญหาตอนเพิ่มพัสดุ:", error);
    res.status(500).json({ message: error.message || 'Error creating item' });
  }
});

// 3. แก้ไขพัสดุ
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { errors, name, category, quantity } = validateItemInput(req.body, { partial: true });
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'กรุณาตรวจสอบข้อมูลพัสดุ', errors });
    }

    const update = { ...req.body };
    if (name !== undefined) update.name = name;
    if (category !== undefined) update.category = category;
    if (req.body.quantity !== undefined) update.quantity = quantity;

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      update,
      { returnDocument: 'after', runValidators: true }
    );
    if (!updatedItem) {
      return res.status(404).json({ message: 'ไม่พบพัสดุนี้' });
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

// 4. ลบพัสดุ (เฉพาะ Admin)
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