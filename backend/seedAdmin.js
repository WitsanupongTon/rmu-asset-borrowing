const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('มีบัญชี Admin อยู่ในระบบแล้ว');
      process.exit();
    }

    const hashedPassword = await bcrypt.hash('admin1234', 10);
    const adminUser = new User({
      username: 'admin',
      password: hashedPassword,
      fullName: 'ผู้ดูแลระบบ กองกลาง',
      department: 'สำนักงานกองกลาง',
      role: 'admin',
      status: 'approved'
    });

    await adminUser.save();
    console.log('สร้างบัญชี Admin สำเร็จ! (Username: admin, Password: admin1234)');
    process.exit();
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  }
};

createAdmin();