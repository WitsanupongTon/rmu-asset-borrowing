const mongoose = require('mongoose');

const registrationRequestSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  department: { type: String, default: '-' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

registrationRequestSchema.index({ username: 1, status: 1 });

module.exports = mongoose.model('RegistrationRequest', registrationRequestSchema);