const mongoose = require('mongoose');

const borrowSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  requestId: { type: String },
  quantity: { type: Number, required: true, default: 1 },
  days: { type: Number, required: true, default: 7 }, 
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'returned'], 
    default: 'pending' 
  },
  borrowDate: { type: Date, default: Date.now },
  dueDate: { type: Date }, // 📌 สิ่งที่เพิ่ม: เก็บวันกำหนดคืน
  returnDate: { type: Date }
}, { timestamps: true });

borrowSchema.index(
  { user: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } }
);

module.exports = mongoose.model('Borrow', borrowSchema);