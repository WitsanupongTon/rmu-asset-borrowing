# RMU Asset Borrowing

เอกสารนี้สรุปการทำงานของระบบยืม-คืนอุปกรณ์ของมหาวิทยาลัยราชภัฏมหาสารคามจากโค้ดใน repository ปัจจุบัน เพื่อให้ผู้พัฒนาหรือ AI คนถัดไปเข้าใจโครงสร้าง ข้อมูล ลำดับการทำงาน และจุดที่ควรระวังก่อนแก้ไข

## 1. ภาพรวมระบบ

ระบบเป็นเว็บแอปแบบแยกส่วน:

- `backend/` เป็น REST API ด้วย Node.js, Express และ MongoDB ผ่าน Mongoose
- `frontend/` เป็น React 19 + Vite ใช้ React Router สำหรับเปลี่ยนหน้า
- ใช้ JWT สำหรับ login และตรวจสอบสิทธิ์
- ใช้ Socket.IO เพื่อ broadcast event เมื่อผู้ใช้ คลัง หรือรายการยืมเปลี่ยนแปลง
- ฝั่ง frontend ใช้ Axios เป็นตัวกลางเรียก API และแนบ JWT จาก `localStorage` อัตโนมัติ
- UI ใช้ Tailwind CSS, SweetAlert2 และ Recharts บางหน้าจอ

หน้าที่หลักของระบบคือ:

1. ให้ผู้ใช้ลงทะเบียนและรอ Admin อนุมัติ
2. ให้ Admin จัดการผู้ใช้และกำหนดบทบาท
3. ให้ Admin เพิ่ม แก้ไข ลบ และตรวจสอบจำนวนอุปกรณ์
4. ให้ผู้ใช้เลือกอุปกรณ์ ระบุจำนวนและระยะเวลายืม แล้วส่งคำร้อง
5. ให้ Admin อนุมัติหรือปฏิเสธคำร้อง
6. เมื่อต้องคืนของ Admin เป็นผู้รับคืนและระบบเพิ่มจำนวนกลับเข้าคลัง
7. แสดง dashboard, แจ้งเตือน, ประวัติ และรายการเกินกำหนด

## 2. โครงสร้างโฟลเดอร์ที่สำคัญ

```text
backend/
	server.js                 จุดเริ่มต้น Express และ Socket.IO
	seedAdmin.js              สคริปต์สร้าง Admin เริ่มต้น
	config/db.js              ฟังก์ชันเชื่อมต่อ MongoDB
	middleware/auth.js        protect และ adminOnly
	models/User.js            schema ผู้ใช้
	models/RegistrationRequest.js คำขอสมัครที่ยังไม่เป็นบัญชีผู้ใช้
	models/Item.js            schema อุปกรณ์
	models/Borrow.js          schema รายการยืม
	routes/auth.js            register และ login
	routes/items.js           CRUD อุปกรณ์
	routes/borrows.js         ยื่นคำร้อง อนุมัติ คืน และประวัติ
	routes/users.js           จัดการผู้ใช้และการอนุมัติสมาชิก

frontend/src/
	App.jsx                   routing หลัก
	api/axios.js              Axios instance และ JWT interceptor
	socket.js                 Socket.IO client ที่ใช้ร่วมกัน
	components/               ProtectedRoute, Navbar และ LoadingState
	layouts/                  AdminLayout และ UserLayout
	pages/                    login/register และหน้าใช้งานต่าง ๆ
	index.css                 เปิดใช้ Tailwind CSS
	App.css                   CSS เดิมจาก Vite template ส่วนใหญ่ไม่ได้ถูกใช้
```

## 3. การตั้งค่าและการรัน

### Backend

ไฟล์ `backend/.env` ต้องมีตัวแปรต่อไปนี้ โดยห้ามนำค่าจริงขึ้น Git:

```env
PORT=5000
MONGO_URI=<MongoDB connection string>
JWT_SECRET=<secret สำหรับเซ็น JWT>
```

คำสั่ง:

```bash
cd backend
npm install
npm run dev       # nodemon server.js
# หรือ
npm start         # node server.js
```

สร้าง Admin เริ่มต้น:

```bash
cd backend
node seedAdmin.js
```

สคริปต์นี้สร้างผู้ใช้ `admin` ด้วยรหัสผ่านเริ่มต้นที่กำหนดไว้ในไฟล์ `seedAdmin.js` เฉพาะเมื่อยังไม่มี username นี้ในฐานข้อมูล ควรเปลี่ยนรหัสผ่านหรือปรับสคริปต์ก่อนใช้งานจริง

### Frontend

```bash
cd frontend
npm install
npm run dev
```

frontend เรียก API ที่ `http://localhost:5000/api` และเชื่อม Socket.IO ที่ `http://localhost:5000` ตามที่กำหนดตายตัวใน `src/api/axios.js` และ `src/socket.js` หากเปลี่ยน environment ต้องแก้สองไฟล์นี้ หรือปรับให้ใช้ environment variable

คำสั่งอื่น:

```bash
npm run build
npm run lint
npm run preview
```

## 4. โครงสร้างข้อมูล MongoDB

### User (`models/User.js`)

- `username`: String, required, unique
- `password`: String ที่ hash ด้วย bcryptjs
- `fullName`: String, required
- `department`: String, default `-`; ไม่ได้ขอจากผู้ใช้ในฟอร์มสมัครปัจจุบัน
- `role`: `user` หรือ `admin`, ค่าเริ่มต้น `user`
- `status`: `pending`, `approved` หรือ `rejected`, ค่าเริ่มต้น `pending`
- มี `createdAt` และ `updatedAt`

บัญชี User ที่อนุมัติแล้วจะมี `role=user` และ `status=approved`; ผู้ใช้ใหม่จะยังไม่มีเอกสารใน collection นี้ก่อนอนุมัติ Admin ไม่ถูกบังคับด้วย status ตอน login

ปัจจุบันการสมัครใหม่จะยังไม่สร้างเอกสารใน collection `User` แต่บันทึกข้อมูล (รวม password hash) ลง collection `RegistrationRequest` แยกต่างหากเพื่อรอพิจารณา เมื่ออนุมัติจึงสร้าง User ด้วย `status=approved` และลบ password hash ออกจากคำขอ ส่วนคำขอที่ถูกปฏิเสธจะเก็บสถานะไว้ แต่ลบ password hash เช่นกัน บัญชี pending ที่สร้างไว้ก่อนการแยก collection ยังแสดงในคิวอนุมัติเพื่อรองรับข้อมูลเดิม

### RegistrationRequest (`models/RegistrationRequest.js`)

- `username`: ชื่อผู้ใช้ที่ต้องการสมัคร
- `password`: password hash ชั่วคราว ระหว่างรอผลอนุมัติ
- `fullName`: ชื่อ-นามสกุล
- `department`: ค่าเริ่มต้น `-`
- `status`: `pending`, `approved` หรือ `rejected`
- มี `createdAt` และ `updatedAt`

### Item (`models/Item.js`)

- `name`: ชื่ออุปกรณ์, required
- `category`: หมวดหมู่, required
- `quantity`: จำนวนคงเหลือ, Number, required, default `0`
- `description`: คำอธิบาย, default `-`
- `image`: URL หรือ Data URL ของรูป, มี placeholder เป็นค่าเริ่มต้น
- มี `createdAt` และ `updatedAt`

รูปที่เลือกจากหน้า Inventory จะถูกอ่านเป็น Base64 Data URL และส่งเก็บตรง ๆ ใน MongoDB จำกัดขนาดไฟล์ฝั่ง frontend ไว้ที่ 1 MB

### Borrow (`models/Borrow.js`)

- `user`: ObjectId อ้างอิง User
- `item`: ObjectId อ้างอิง Item
- `requestId`: idempotency key ของรายการจาก cart (optional สำหรับรายการเดิม) ใช้ป้องกันสร้างคำขอซ้ำเมื่อ retry
- `quantity`: จำนวนที่ยืม, default `1`
- `days`: จำนวนวันที่ขอยืม, default `7`
- `status`: `pending`, `approved`, `rejected` หรือ `returned`
- `borrowDate`: วันที่สร้างรายการ, default เวลาปัจจุบัน
- `dueDate`: กำหนดคืน จะถูกคำนวณเมื่อ Admin อนุมัติ
- `returnDate`: วันที่รับคืนจริง
- มี `createdAt` และ `updatedAt`

## 5. การยืนยันตัวตนและสิทธิ์

ใน `backend/middleware/auth.js`:

- `protect` อ่าน header `Authorization: Bearer <token>`
- ตรวจ JWT ด้วย `JWT_SECRET`
- ค้นหา user จาก `decoded.id` และใส่ user ที่ไม่รวม password ไว้ใน `req.user`
- ถ้าไม่มี token, token ไม่ถูกต้อง หรือหา user ไม่เจอ จะตอบ `401`
- `adminOnly` อนุญาตเฉพาะ `req.user.role === 'admin'` ถ้าไม่ใช่จะตอบ `403`

ตอน login backend สร้าง JWT อายุ 1 วัน โดย payload มี `id`, `role` และ `fullName` จากนั้น frontend เก็บ token และข้อมูล user ใน `localStorage`

ใน `frontend/src/components/ProtectedRoute.jsx` จะตรวจ token และ user ใน browser แล้วจำกัดเส้นทางตาม role แต่การป้องกันที่เชื่อถือได้จริงยังอยู่ที่ middleware ฝั่ง backend

## 6. REST API ทั้งหมด

Base URL คือ `http://localhost:5000/api`

### Authentication

| Method | Path | สิทธิ์ | การทำงาน |
|---|---|---|---|
| POST | `/auth/register` | สาธารณะ | สร้าง RegistrationRequest ที่ pending (ยังไม่สร้าง User) และ emit `users_updated` |
| POST | `/auth/login` | สาธารณะ | ตรวจ username/password, ตรวจ approval และคืน JWT กับ user |

ข้อมูล register ที่ใช้คือ `username`, `password`, `fullName` โดย backend จะตั้ง `department` เป็น `-` อัตโนมัติ

### Items

| Method | Path | สิทธิ์ | การทำงาน |
|---|---|---|---|
| GET | `/items` | login แล้ว | ดึงอุปกรณ์ทั้งหมด เรียง `createdAt` ล่าสุดก่อน |
| POST | `/items` | Admin | เพิ่มอุปกรณ์ |
| PUT | `/items/:id` | Admin | แก้ไขอุปกรณ์ |
| DELETE | `/items/:id` | Admin | ลบอุปกรณ์ |

การเพิ่ม แก้ไข หรือลบ item จะ emit `inventory_updated` และ `itemsUpdated`

### Borrows

| Method | Path | สิทธิ์ | การทำงาน |
|---|---|---|---|
| POST | `/borrows/request` | login แล้ว | สร้างคำร้องยืมหนึ่งรายการ โดยใช้ user จาก token |
| POST | `/borrows/request-batch` | login แล้ว | สร้างคำร้องหลายรายการจาก cart แบบ idempotent ด้วย `requestId` ต่อรายการ |
| GET | `/borrows/my-history` | login แล้ว | ประวัติของ user จาก token |
| GET | `/borrows/admin/all` | Admin | รายการยืมทั้งหมด พร้อม populate user และ item |
| PUT | `/borrows/:id/status` | Admin | เปลี่ยนเป็น `approved` หรือ `rejected` |
| PUT | `/borrows/:id/return` | Admin | เปลี่ยนเป็น returned และคืนจำนวนเข้าคลัง |
| GET | `/borrows/user/:userId` | login แล้ว | ดึงประวัติตาม user ID ใช้โดยหน้า UserHistory |

เมื่อสร้างคำร้อง ระบบเช็คว่า item มีจำนวนพอ แต่ยังไม่ตัดสต๊อกจนกว่า Admin อนุมัติ

เมื่ออนุมัติ:

1. backend ดึง item ล่าสุดและตรวจจำนวนอีกครั้ง
2. ใช้ `days` จากคำขอ หรือ `7` ถ้าไม่มี
3. คำนวณ `dueDate` จากเวลาที่อนุมัติ (`new Date()`) ไม่ใช่จาก `borrowDate`
4. ลด `Item.quantity` ด้วย `$inc: { quantity: -borrow.quantity }`
5. เปลี่ยน borrow เป็น `approved`

เมื่อรับคืน:

1. เปลี่ยน status เป็น `returned`
2. ตั้ง `returnDate` เป็นเวลาปัจจุบัน
3. เพิ่มจำนวนอุปกรณ์กลับด้วย `$inc: { quantity: borrow.quantity }`

การเปลี่ยนแปลง borrow หรือ stock จะ emit `borrow_updated`, `borrowsUpdated`, `inventory_updated` และ `itemsUpdated`

หน้า `/borrow` เก็บ cart draft ใน `localStorage` แยกตาม user ID โดยเก็บเฉพาะ item ID, ชื่อ, จำนวน, จำนวนวัน และ request ID ไม่เก็บรูป เมื่อกลับเข้าหน้าจะโหลด inventory ล่าสุดมาเทียบกับ draft; item ที่ถูกลบหรือมี stock ไม่พอจะแสดงเตือนและส่งไม่ได้

การส่ง cart ใช้ `POST /borrows/request-batch` หนึ่งครั้ง ระบบตรวจ stock ล่าสุดและบันทึกแต่ละรายการด้วย unique key `(user, requestId)` พร้อม upsert ทำให้ retry ด้วย draft เดิมไม่สร้าง Borrow ซ้ำ หากไม่ทราบผลจาก network error ระบบล็อก draft และให้ส่งรายการเดิมซ้ำเพื่อยืนยันผล ก่อนจึงจะล้าง cart หลัง API สำเร็จ

### Users

| Method | Path | สิทธิ์ | การทำงาน |
|---|---|---|---|
| GET | `/users/all` | Admin | ดึง Admin และบัญชี approved โดยไม่ส่ง password; ไม่รวมคำขอสมัครที่ยัง pending |
| POST | `/users/add` | Admin | สร้างบัญชีผู้ใช้โดย Admin และ hash password; ค่าเริ่มต้นเป็น approved |
| PUT | `/users/:id` | Admin | แก้ fullName, role, status, department |
| DELETE | `/users/:id` | Admin | ลบผู้ใช้ |
| GET | `/users/pending` | Admin | ดึง RegistrationRequest ที่ pending และ pending User เก่าที่ยังต้องจัดการ |
| PUT | `/users/:id/approve` | Admin | อนุมัติ/ปฏิเสธคำขอ; ถ้าอนุมัติ RegistrationRequest จะสร้าง User จริงในขั้นตอนนี้ |

การเปลี่ยนแปลง user จะ emit `users_updated`

## 7. ลำดับการทำงานของผู้ใช้

### ผู้ใช้ทั่วไป

1. เปิด `/register` และส่งข้อมูลไป `POST /api/auth/register`; ระบบบันทึกเป็นคำขอสมัคร ไม่ใช่ User account
2. คำขอปรากฏที่ `/admin/approve-users` โดยไม่ปรากฏใน `/admin/users`
3. รอ Admin อนุมัติ; เมื่ออนุมัติ backend จึงสร้าง User account จริง
4. เปิด `/login` และเข้าสู่ระบบได้หลังอนุมัติเท่านั้น
5. frontend เก็บ JWT แล้วไป `/dashboard` ซึ่ง redirect ต่อไป `/borrow`
6. หน้า `/borrow` โหลด item จาก `GET /items`
7. เลือก item, จำนวน และจำนวนวันลงตะกร้า
8. cart draft ถูกเก็บแยกตาม user และกู้คืนเมื่อกลับเข้าหน้า พร้อมตรวจ stock ล่าสุด
9. กดส่งคำร้อง ระบบส่ง cart ทั้งหมดด้วย `POST /borrows/request-batch`; กรณี network error สามารถ retry draft เดิมโดยไม่สร้างคำขอซ้ำ
10. ดูประวัติของตัวเองที่ `/history` ซึ่งเรียก `GET /borrows/user/:userId`

### Admin

1. login ด้วย role admin แล้วไป `/admin`
2. Dashboard โหลด borrow ทั้งหมด, item ทั้งหมด และ user ทั้งหมด
3. อนุมัติสมาชิกที่ `/admin/approve-users`
4. จัดการบัญชีที่ `/admin/users`
5. จัดการอุปกรณ์ที่ `/admin/inventory`
6. ตรวจคำร้องยืมที่ `/admin/borrow-requests`
7. อนุมัติหรือปฏิเสธคำร้อง
8. รับคืนรายการที่ `/admin/returns`
9. ดูรายการทั้งหมดที่ `/admin/history`

## 8. Frontend routes และหน้าที่

### Public

- `/login`: login และบันทึก token/user
- `/register`: สมัครสมาชิก
- `/`: redirect ไป `/login`

### User protected routes

`UserLayout` แสดงข้อมูลสรุปจำนวนชนิดพัสดุในคลัง (นับจำนวนรายการ Item ไม่ได้นับหมวดหมู่), จำนวนรายการที่ผู้ใช้กำลังยืม และรายการที่เกินกำหนด รวมถึง menu:

- `/dashboard`: redirect ไป `/borrow`
- `/borrow`: ใช้ component `pages/admin/BorrowEquipment.jsx` ร่วมกับ Admin เพื่อเลือกและส่งคำร้อง
- `/history`: ประวัติยืม-คืนพัสดุของ user ปัจจุบัน มีช่องค้นหาชื่อพัสดุและปุ่มแฮมเบอร์เกอร์กรองสถานะพร้อมจำนวน เช่น กำลังยืม รออนุมัติ เลยกำหนด คืนแล้ว และไม่อนุมัติ; การค้นหาและตัวกรองใช้ร่วมกันได้

### Admin protected routes

`AdminLayout` โหลดข้อมูลสรุปและคำนวณ badge notification จากรายการที่ pending, overdue และประวัติล่าสุด โดยเก็บรายการที่อ่านแล้วไว้ใน `localStorage` key `seenNotificationIds`

หน้าที่โหลดข้อมูลจาก API จะแสดง `components/LoadingState.jsx` ระหว่างการโหลดครั้งแรก โดยใช้ spinner และข้อความที่เหมาะกับแต่ละหน้า เช่น คลังอุปกรณ์ คำร้องยืม รายการคืน ผู้ใช้ และประวัติ การโหลดซ้ำจาก Socket จะอัปเดตข้อมูลเดิมเบื้องหลังโดยไม่เปลี่ยนหน้ากลับไปเป็น spinner

- `/admin`: Dashboard สำหรับติดตามสถานะยืม-คืน ประกอบด้วย KPI ปัจจุบัน (พัสดุในคลัง, ผู้ใช้งานทั้งหมด, กำลังถูกยืม, คำร้องรออนุมัติ, รายการเกินกำหนด), กราฟเส้นแนวโน้มการยืม, กราฟแท่ง Top 5 ตามปริมาณการยืมสะสม, donut สัดส่วนคืนตรงเวลา/คืนช้าหรือเกินกำหนด/ไม่อนุมัติ และตาราง 5 รายการที่ต้องติดตามโดยเรียง pending และ overdue ไว้ก่อน
- `/admin/borrow`: หน้ายืมอุปกรณ์ที่ใช้ component ร่วมกับ user
- `/admin/inventory`: CRUD อุปกรณ์, ค้นหา, แบ่งหน้า, อัปโหลดรูปแบบ Base64
- `/admin/users`: CRUD user และเปลี่ยน role
- `/admin/approve-users`: อนุมัติหรือปฏิเสธ user ที่ pending
- `/admin/borrow-requests`: อนุมัติหรือปฏิเสธคำร้องยืม
- `/admin/returns`: รับคืนเฉพาะ borrow ที่ approved และแสดงรายการเกินกำหนด
- `/admin/history`: ประวัติ borrow ทั้งหมดและสถานะปัจจุบัน

Dashboard ใช้ Recharts และมีปุ่มสร้าง PDF ด้วย browser print: เลือกได้ทั้งรายเดือน, ปีปฏิทิน หรือปีงบประมาณ พ.ศ. (1 ตุลาคมถึง 30 กันยายนของปีถัดไป) เมื่อเลือกรายเดือนกราฟแนวโน้มจะแสดงเฉพาะเดือนนั้น; เมื่อเลือกปีจะแสดง 12 เดือนในช่วงปีที่เลือก กราฟและตารางธุรกรรมใช้ช่วงที่เลือก ส่วน KPI และจำนวนคลัง/ผู้ใช้เป็นสถานะปัจจุบัน รายงานพิมพ์บน A4 แนวนอน มีหัวกระดาษชื่อหน่วยงาน ช่วงเวลา และวันที่จัดทำ ถ้าช่วงนั้นไม่มีรายการ ระบบแสดงข้อความยืนยันว่าไม่พบประวัติแทนกราฟ/ตาราง

หน้า `/admin/history` มีช่องค้นหาและเมนูแฮมเบอร์เกอร์กรองสถานะพร้อมจำนวน เช่นเดียวกับหน้า User History โดยสถานะ “กำลังยืม” และ “เลยกำหนด” แยกจากกัน

ฟอร์มที่มีข้อมูลจำเป็นแสดงเครื่องหมาย `*` สีแดงและใช้ HTML required; Backend ตรวจข้อมูลสำคัญซ้ำ เช่น ชื่อ/หมวดหมู่/จำนวนพัสดุ, ข้อมูลสมัคร และข้อมูลคำขอยืม เพื่อไม่พึ่ง validation ฝั่ง browser เพียงอย่างเดียว ปุ่ม/วันที่/ตารางหลักปรับเป็นขนาดตัวอักษรที่อ่านง่ายขึ้น

ข้อความที่ผู้ใช้เห็นใช้คำว่า “พัสดุ” เป็นมาตรฐานเดียวกัน ส่วนชื่อ field ภายใน API และฐานข้อมูล เช่น `Item` และ `itemId` คงเดิมเพื่อไม่ทำให้ข้อมูลเดิมหรือสัญญา API เสียหาย

Admin ต้องยืนยันก่อนออกจากระบบด้วยกล่องยืนยันของ SweetAlert2 เช่นเดียวกับ User หากยกเลิกจะยังอยู่หน้าเดิม

### Public page UI

- Login และ Register ใช้พื้นหลัง gradient `indigo -> purple` แบบเดียวกับหน้า Admin
- กล่องฟอร์มใช้พื้นสีขาว ขอบ เส้นแบ่ง และเงาเพื่อให้แยกจากพื้นหลังชัดเจน
- Register ไม่มีช่อง `หน่วยงาน / คณะ` แล้ว และแสดงหมายเหตุให้รอ Admin อนุมัติก่อนเข้าสู่ระบบ
- ข้อมูลสมัครสมาชิกที่ส่งคือ `username`, `password` และ `fullName`; backend ตั้ง `department` เป็น `-` อัตโนมัติ

## 9. Real-time ด้วย Socket.IO

backend สร้าง Socket.IO server ใน `backend/server.js` และใส่ `io` ไว้ใน `req.io` ผ่าน middleware เพื่อให้ route emit event ได้

frontend มี socket instance กลางใน `frontend/src/socket.js` โดยเชื่อมต่อ `http://localhost:5000` ด้วย polling/websocket

event ที่ใช้อยู่:

- `users_updated`: มีการสมัครหรือแก้ไข user
- `inventory_updated`: stock หรือ item เปลี่ยน
- `itemsUpdated`: event สำรอง/ชื่อที่หลายหน้าฟังอยู่
- `borrow_updated`: borrow เปลี่ยน
- `borrowsUpdated`: event สำรอง/ชื่อที่หลายหน้าฟังอยู่

เมื่อรับ event แต่ละหน้าจะเรียก API ใหม่ ไม่ได้ส่งข้อมูล record ผ่าน Socket ดังนั้น Socket มีหน้าที่เป็นสัญญาณให้ refetch เท่านั้น

## 10. สิ่งที่ควรรู้ก่อนแก้ไข

ประเด็นต่อไปนี้เป็นพฤติกรรมหรือข้อจำกัดจากโค้ดปัจจุบัน ไม่ใช่เอกสารว่าระบบได้แก้ไขแล้ว:

1. `GET /borrows/user/:userId` ตรวจเพียงว่า login แล้ว แต่ไม่ได้ตรวจว่า `userId` เป็นของผู้เรียกหรือเป็น Admin จึงควรเพิ่ม authorization หาก endpoint นี้เปิดใช้งานจริง
2. `POST /borrows/request` รับ `userId` จาก frontend แต่ backend ไม่ใช้ค่า body และใช้ `req.user._id` ซึ่งเป็นพฤติกรรมที่ถูกต้องกว่า อย่าเปลี่ยนให้เชื่อ body โดยไม่ตรวจสิทธิ์
3. การอนุมัติและรับคืนแก้ stock กับ borrow แยกคำสั่งกันและไม่มี transaction จึงควรพิจารณา MongoDB transaction หากต้องรองรับการใช้งานพร้อมกันจำนวนมาก
4. endpoint รับคืนไม่ได้ตรวจว่า borrow อยู่สถานะ `approved` หรือเคย `returned` แล้ว การเรียกซ้ำอาจเพิ่ม stock ซ้ำได้ ควรตรวจสถานะก่อนเพิ่มจำนวน
5. การสร้างคำร้องเช็ค stock แต่ยังไม่ reserve stock จนถึงเวลาอนุมัติ จึงอาจมีหลายคำร้องขอ item เดียวกันผ่านการเช็คเบื้องต้นพร้อมกันได้ อย่างไรก็ตามตอนอนุมัติมีการเช็คซ้ำ
6. backend ไม่มี validation เชิงธุรกิจที่ละเอียดสำหรับ quantity, days, role และ status นอกจาก Mongoose schema บางส่วน ควรเพิ่ม validation ก่อนใช้ใน production
7. หน้า `ApproveUsers` ใช้ `PUT /users/:id/approve`; route นี้รองรับทั้ง RegistrationRequest ปัจจุบันและ User สถานะ pending ที่สร้างไว้ก่อนแยก collection
8. หน้า `Users` ส่งข้อมูล user ตอนแก้ไข แต่ backend route แก้เฉพาะ fullName, role, status และ department ไม่ได้เปลี่ยน password ซึ่งเป็นพฤติกรรมปัจจุบัน
9. `AdminBorrowRequests` ฟัง `itemsUpdated` เป็นหลัก แม้ backend emit event นี้ร่วมด้วย หากเปลี่ยนชื่อ event ต้องแก้ listener ของหน้านี้ด้วย
10. event ถูก emit แบบ broadcast ให้ทุก client ไม่มี room หรือการกรองตามผู้ใช้ ทุก client จึงอาจ refetch พร้อมกัน
11. CORS ของ Express และ Socket.IO เปิด `origin: "*"` เหมาะกับการพัฒนาเท่านั้น ควรจำกัด origin ก่อน deploy
12. Axios และ Socket URL เป็น localhost แบบ hard-code และ index HTML ยังใช้ title `frontend` กับ favicon จาก Vite template
13. `Navbar.jsx` มี component ว่างและไม่ได้ถูกใช้โดย routing ปัจจุบัน อย่าเข้าใจว่าเป็น navigation หลักของระบบ
14. `App.css` ยังมี CSS จาก Vite template ขณะที่หน้าหลักใช้ Tailwind ใน `index.css` เป็นหลัก
15. การเก็บ JWT และข้อมูล user ใน `localStorage` มีความเสี่ยงจาก XSS หากนำไปใช้งานจริงควรทบทวนการเก็บ token และเพิ่มมาตรการความปลอดภัย
16. ไม่มี automated test ใน package scripts ของ backend และ frontend มีเพียง build/lint จึงควรทดสอบ flow ยืม-อนุมัติ-คืนด้วย integration test ก่อน refactor ใหญ่

## 11. แนวทางการแก้ไขต่อสำหรับ AI

ก่อนแก้ไขควร:

1. ระบุว่าการเปลี่ยนแปลงอยู่ที่ backend route/model หรือ frontend page/layout ก่อน
2. ตรวจชื่อ endpoint และชื่อ Socket event ให้ตรงกับตารางในเอกสารนี้
3. การเปลี่ยนสถานะ borrow ต้องคิดผลต่อ stock, `dueDate`, `returnDate` และหน้าประวัติพร้อมกัน
4. การเปลี่ยน role/status ต้องคิดทั้ง backend middleware และ `ProtectedRoute`
5. หลังแก้ backend ให้ทดสอบ API ด้วย token ของ user และ admin แยกกัน
6. หลังแก้ frontend ให้รัน `npm run lint` และ `npm run build` ใน `frontend`
7. ห้ามใส่ค่าใน `.env` จริงลงเอกสารหรือ commit

## 12. สรุปสั้น

นี่คือระบบยืม-คืนอุปกรณ์ที่มี workflow หลักเป็น `สมัครสมาชิก -> Admin อนุมัติ -> ผู้ใช้ส่งคำร้อง -> Admin อนุมัติ -> ตัด stock -> Admin รับคืน -> เพิ่ม stock และบันทึกประวัติ` โดย REST API เป็นแหล่งข้อมูลหลัก และ Socket.IO ใช้แจ้งให้ frontend โหลดข้อมูลล่าสุดอีกครั้ง
