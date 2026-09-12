const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  description: { type: String, default: '-' },
  image: { type: String, default: 'https://placehold.co/150?text=No+Image' } 
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);