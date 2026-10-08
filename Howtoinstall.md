# คู่มือการติดตั้งและนำระบบ RMU Asset Borrowing ไปใช้งาน

เอกสารนี้อธิบายตั้งแต่เตรียมคอมพิวเตอร์ Windows เครื่องใหม่ ดาวน์โหลดโค้ดจาก GitHub ติดตั้งโปรแกรมและ dependencies ตั้งค่า MongoDB รันระบบในเครื่อง ไปจนถึงแนวทางเตรียม deploy ขึ้นเซิร์ฟเวอร์

> ข้อสำคัญ: คำสั่ง `npm install` ใช้ติดตั้งแพ็กเกจที่ประกาศใน `package.json` เท่านั้น ไม่ได้ติดตั้ง VS Code, Node.js, Git หรือ MongoDB ให้ ต้องติดตั้งโปรแกรมพื้นฐานเหล่านี้ก่อน

## 1. สถาปัตยกรรมและสิ่งที่ต้องติดตั้ง

โปรเจกต์แบ่งเป็น 2 workspace โดยใช้ npm workspaces ที่โฟลเดอร์ราก:

- **Frontend:** React 19, Vite, React Router, Tailwind CSS, Axios, Recharts, Socket.IO Client, SweetAlert2 และ Lucide React
- **Backend:** Node.js, Express 5, MongoDB ผ่าน Mongoose, JWT, bcryptjs, CORS และ Socket.IO
- **Root tools:** `concurrently` ใช้เปิด frontend และ backend พร้อมกัน
- **ฐานข้อมูล:** MongoDB Atlas (แนะนำ) หรือ MongoDB server ที่เข้าถึงได้จาก backend

ในเครื่องผู้พัฒนา ให้ติดตั้ง:

1. Windows 10/11 ที่อัปเดตแล้ว
2. Git for Windows เพื่อ clone/pull โค้ดจาก GitHub
3. Node.js รุ่น LTS ที่รองรับ Vite ปัจจุบัน แนะนำ Node.js 22 LTS พร้อม npm
4. Visual Studio Code (ไม่บังคับต่อการรัน แต่แนะนำสำหรับแก้โค้ด)
5. เว็บเบราว์เซอร์สมัยใหม่ เช่น Chrome หรือ Edge
6. MongoDB Atlas account/cluster และ Database User สำหรับเชื่อมต่อฐานข้อมูล

ดาวน์โหลดจากเว็บไซต์ทางการ:

- VS Code: https://code.visualstudio.com/Download
- Node.js: https://nodejs.org/en/download (ติดตั้ง Node.js 22 LTS หรือใหม่กว่า และตรวจว่าติดตั้ง npm/เพิ่ม PATH แล้ว)
- Git for Windows: https://git-scm.com/download/win
- MongoDB Atlas: https://www.mongodb.com/atlas/database

ระหว่างติดตั้ง Node.js บน Windows ให้ใช้ตัวเลือกมาตรฐานและเปิดตัวเลือกเพิ่ม Node.js ใน PATH แล้วเปิด PowerShell ใหม่หลังติดตั้ง

ตรวจว่าติดตั้ง Node/npm/Git แล้ว:

```powershell
node --version
npm --version
git --version
```

หาก `node` หรือ `npm` ไม่พบ ให้ปิดและเปิด PowerShell ใหม่ หรือตรวจว่า Node.js ถูกเพิ่มใน PATH แล้ว

## 2. ดาวน์โหลดโปรเจกต์จาก GitHub

เลือกโฟลเดอร์ที่จะเก็บงาน แล้ว clone repository:

```powershell
cd D:\Projects
git clone https://github.com/WitsanupongTon/rmu-asset-borrowing.git
cd rmu-asset-borrowing
```

ถ้า repository เป็น private ต้อง sign in/ตั้งค่า GitHub access ก่อน หากโฟลเดอร์มีอยู่แล้ว ให้ใช้ `git pull` แทน `git clone`:

```powershell
cd D:\Projects\rmu-asset-borrowing
git pull
```

ก่อนติดตั้งให้ตรวจว่าตำแหน่งปัจจุบันคือโฟลเดอร์ที่มี root `package.json`, `backend/` และ `frontend/`:

```powershell
Get-Location
Get-ChildItem
```

## 3. ติดตั้ง dependencies ทั้งระบบ

ทำจากโฟลเดอร์รากของ repository เพียงครั้งเดียว:

```powershell
npm install
```

คำสั่งนี้อ่าน root `package.json` ซึ่งกำหนด workspaces เป็น `backend` และ `frontend` แล้วติดตั้งแพ็กเกจของ root, backend และ frontend ให้ครบ พร้อมจัดการไฟล์ lock ตาม package manifests

หลังติดตั้งจะมีโฟลเดอร์ `node_modules` (npm อาจ hoist dependencies ไว้ที่ root) ไม่ต้องเข้าไปติดตั้งแต่ละโฟลเดอร์ซ้ำ หาก clone โค้ดมาใหม่หรือมีการเปลี่ยน dependencies ให้รัน `npm install` ที่ root อีกครั้ง

ครั้งแรกที่ติดตั้งหลัง clone ให้ตรวจว่ามี root `package-lock.json` ที่อัปเดตตรงกับ `package.json` และ workspaces แล้ว commit lockfile ที่ npm สร้าง/ปรับปรุงไปพร้อมกับการเปลี่ยน package manifests จากนั้นทีมจึงติดตั้งซ้ำได้อย่างสม่ำเสมอ

### แพ็กเกจหลักที่ติดตั้ง

**Root:**

- `concurrently` — รันคำสั่ง frontend และ backend พร้อมกัน

**Backend dependencies:**

- `express` — HTTP API server
- `mongoose` — เชื่อมต่อและจัดการ schema MongoDB
- `bcryptjs` — hash รหัสผ่าน
- `jsonwebtoken` — สร้างและตรวจ JWT
- `cors` — ตั้งค่า cross-origin requests
- `dotenv` — โหลดค่าตั้งค่าจาก `.env`
- `socket.io` — real-time events ฝั่ง server
- `nodemon` (dev dependency) — restart backend เมื่อแก้ไฟล์ระหว่างพัฒนา

**Frontend dependencies:**

- `react`, `react-dom` — UI framework
- `vite`, `@vitejs/plugin-react` — dev server และ build tool
- `react-router-dom` — routing
- `tailwindcss`, `@tailwindcss/vite`, `autoprefixer`, `postcss` — CSS pipeline
- `axios` — เรียก REST API
- `socket.io-client` — real-time connection
- `recharts` — กราฟ Dashboard
- `sweetalert2` — dialogs/notifications
- `lucide-react` — icons
- `oxlint` — lint checks
- `@types/react`, `@types/react-dom` — React type definitions ที่มากับ template/tooling

ไม่จำเป็นต้องติดตั้งแพ็กเกจเหล่านี้ด้วย `npm install <ชื่อแพ็กเกจ>` แยกทีละตัว เพราะประกาศไว้ใน manifests แล้ว

## 4. ตั้งค่า MongoDB และ Backend

### 4.1 เตรียมฐานข้อมูล

ระบบต้องเชื่อม MongoDB ก่อนจึงจะใช้งาน API ได้ วิธีที่ง่ายสำหรับทีมคือ MongoDB Atlas:

1. สร้างหรือเลือก Atlas project และ cluster
2. สร้าง Database User พร้อม username/password (เป็น credentials ของฐานข้อมูล ไม่ใช่บัญชี MongoDB website)
3. ใน **Network Access / IP Access List** อนุญาต IP ของเครื่องพัฒนาที่กำลังใช้
4. เลือก **Connect → Drivers** แล้วคัดลอก connection string
5. แทนส่วน `<password>` ด้วย password ของ Database User และระบุชื่อ database ใน URI

ถ้าเปลี่ยนเครือข่าย/VPN แล้ว IP เปลี่ยน Atlas อาจปฏิเสธการเชื่อมต่อ ให้เพิ่ม IP ปัจจุบัน หลีกเลี่ยงการเปิดอนุญาตจากทุก IP (`0.0.0.0/0`) ไว้ถาวร

หมายเหตุสำหรับการ Deploy บน Cloud เช่น Render ให้ตั้งค่า IP Access List เป็น 0.0.0.0/0 Allow Access from Anywhere เพื่อให้ Cloud Server สามารถเชื่อมต่อฐานข้อมูลได้ตลอดเวลา โดยความปลอดภัยจะถูกควบคุมผ่าน Username/Password ของ Database User และการซ่อน MONGO_URI ไว้ใน Environment Variables

### 4.2 ตั้งค่า environment

สร้างไฟล์ `backend/.env` ด้วยตนเองจาก `backend/.env.example` หาก repository มีไฟล์ตัวอย่าง หรือสร้างไฟล์ใหม่โดยใส่ค่าตามรูปแบบนี้:

```env
PORT=5000
MONGO_URI=<MongoDB connection string ของเครื่อง/เซิร์ฟเวอร์นี้>
JWT_SECRET=<random secret ที่คาดเดายากและไม่ซ้ำกับที่อื่น>
```

- ห้ามใส่เครื่องหมาย `< >` รอบค่าจริง
- สร้าง `JWT_SECRET` เป็น random string ยาวและเก็บเป็นความลับ
- ห้ามส่งค่า `.env` ทางแชต/อีเมลสาธารณะ ห้ามใส่ใน README หรือ commit ขึ้น GitHub
- ตรวจ `.gitignore` ก่อน commit: ใน repository รุ่นที่จัดทำคู่มือนี้ยังควรเพิ่ม `.env` และ `backend/.env` เข้า ignore list เอง หากไฟล์เคยถูก commit ไปแล้ว การเพิ่ม ignore อย่างเดียวไม่ถอน secret ออกจากประวัติ Git ต้องเปลี่ยน credentials ที่รั่วและจัดการ Git history ด้วย

`backend/config/db.js` ใช้ `MONGO_URI` เชื่อม MongoDB และ backend จะออกจาก process หากเชื่อมต่อไม่ได้

## 5. รันระบบบนเครื่องพัฒนา

### เปิด Frontend และ Backend พร้อมกัน (แนะนำ)

ที่โฟลเดอร์ราก:

```powershell
npm run dev
```

คำสั่งนี้ใช้ `concurrently` เปิด:

- Backend API + Socket.IO: `http://localhost:5000`
- Frontend Vite: โดยปกติ `http://localhost:5173`

ปล่อย Terminal นี้ทำงานค้างไว้ ระหว่างใช้งานกด `Ctrl+C` เพื่อหยุดทั้งสอง process

### เปิดแยก Terminal

Terminal ที่ 1 — Backend:

```powershell
npm run dev --workspace=backend
```

Terminal ที่ 2 — Frontend:

```powershell
npm run dev --workspace=frontend
```

หากต้องรันโดยเข้าโฟลเดอร์โดยตรง:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

## 6. สร้างบัญชี Admin เริ่มต้น

สคริปต์ `backend/seedAdmin.js` สร้าง Admin เมื่อยังไม่มี username `admin` ในฐานข้อมูล ใช้ `.env` ของ backend จึงให้รันจากโฟลเดอร์ backend:

```powershell
cd backend
node seedAdmin.js
```

สคริปต์ปัจจุบันกำหนดรหัสเริ่มต้นไว้เป็น `admin1234` ห้ามใช้รหัสนี้ใน production และควรเปลี่ยน/ปรับวิธี seed ก่อน deploy เมื่อสร้าง Admin แล้ว ผู้ใช้ทั่วไปสมัครจากหน้า Register จะถูกบันทึกเป็นคำขอ รออนุมัติในหน้า Admin ก่อนจึงกลายเป็น User account

## 7. ทดสอบและสร้าง production build

จากโฟลเดอร์ราก:

```powershell
npm run build --workspace=frontend
npm run lint --workspace=frontend
```

เมื่อ build สำเร็จ ไฟล์ static อยู่ที่ `frontend/dist/` นำ directory นี้ไปให้ static hosting ให้บริการ ส่วน Preview สำหรับทดสอบ build ในเครื่อง:

```powershell
npm run preview --workspace=frontend
```

Backend production start script:

```powershell
npm start --workspace=backend
```

ปัจจุบัน backend package ไม่มี automated test suite (`npm test` ยังเป็น placeholder) จึงควรทดสอบ login, สมัคร/อนุมัติ, เพิ่มพัสดุ, ยื่นคำขอ, อนุมัติ และรับคืนด้วยบัญชีทดสอบก่อนปล่อยระบบ

## 8. แนวทางนำขึ้น Server / Hosting

### 8.1 เตรียม Backend

1. เลือก Node.js hosting ที่รัน long-lived Node process ได้ เช่น VM, container หรือ Node application service
2. Deploy repository จาก GitHub
3. ตั้ง Environment Variables ใน dashboard ของ hosting (`PORT` ถ้า hosting กำหนดให้, `MONGO_URI`, `JWT_SECRET`) อย่าอัปโหลดไฟล์ `.env` ไป server ผ่าน Git
4. ตั้ง build/install command เป็น `npm install` ที่ root (เพราะใช้ npm workspaces)
5. ตั้ง start command เป็น `npm start --workspace=backend`
6. เปิดให้บริการ Backend ผ่าน HTTPS และตรวจ log ว่าแสดง `MongoDB Connected Successfully` และ `Server running on port ...`
7. ตั้ง MongoDB Atlas Network Access ให้ยอมรับ outbound IP ของ backend host หรือใช้ network integration ที่ hosting/Atlas แนะนำ

### 8.2 เตรียม Frontend ก่อน Deploy

**รุ่นปัจจุบันกำหนด URL API และ Socket เป็น localhost แบบตายตัว** ใน:

- `frontend/src/api/axios.js` → `http://localhost:5000/api`
- `frontend/src/socket.js` → `http://localhost:5000`

ดังนั้น frontend ที่ deploy บน Internet จะพยายามเรียก localhost ของเครื่องผู้เข้าชมและใช้งานจริงไม่ได้ จนกว่าจะเปลี่ยน URL ทั้งสองเป็นโดเมน Backend จริง (เช่น HTTPS API URL และ Socket URL) หรือปรับโค้ดให้ใช้ `VITE_API_URL`/`VITE_SOCKET_URL` environment variables ก่อน build

หลังตั้ง URL แล้ว:

1. ใช้ `npm install` ที่ root
2. สั่ง `npm run build --workspace=frontend`
3. Deploy เนื้อหาใน `frontend/dist/` ไปยัง static hosting/CDN
4. ตั้ง SPA fallback ให้ URL ที่ไม่ใช่ static asset ส่งกลับ `index.html` เพื่อให้ React Router รองรับ `/admin/...`, `/history` และ `/borrow`
5. จำกัด CORS ใน Backend ให้รับเฉพาะ origin ของเว็บไซต์จริง; ปัจจุบัน Express และ Socket.IO เปิด `origin: "*"` ซึ่งไม่ควรใช้เป็นค่า production
6. ใช้ HTTPS ทั้งเว็บและ API; browser จะบล็อกการเรียก HTTP จากหน้า HTTPS (mixed content)

หาก deploy Frontend และ Backend หลัง reverse proxy โดเมนเดียวกัน อาจกำหนด path เช่น `/api` และ `/socket.io` แล้วตั้ง proxy ไป Backend ได้ แต่ต้องปรับ Axios, Socket.IO และ proxy rules ให้ตรงกัน

### 8.3 หลัง Deploy

- ทดสอบ login ด้วย Admin และ User
- ทดสอบ Socket events จากการเพิ่ม/แก้พัสดุและเปลี่ยนสถานะคำขอ
- ตรวจ error logs ของ frontend hosting, backend host และ MongoDB
- ตั้งสำรองข้อมูล MongoDB และจำกัดสิทธิ์ Database User ตามหลัก least privilege
- เปลี่ยนรหัส Admin เริ่มต้นและ rotate secrets ก่อนให้ผู้ใช้จริงเข้าใช้งาน

## 9. วิธีแก้ปัญหาที่พบบ่อย

### `ERR_CONNECTION_REFUSED` ที่ `localhost:5000`

Backend ไม่ได้ทำงานหรือหยุดทำงาน ให้ดู Terminal ของ backend และรัน `npm run dev --workspace=backend` จาก root

### `MongoDB Connection Failed` หรือ Atlas แจ้ง IP ไม่ได้รับอนุญาต

ตรวจ `MONGO_URI`, Database User/password, cluster status และ IP Access List ของ Atlas ตรวจว่า `backend/.env` อยู่ถูก path และไม่มี quote/ช่องว่างแปลกปลอม

### Frontend เปิดได้แต่ API ล้มเหลว

ตรวจว่า backend แสดง port 5000, URL ใน `frontend/src/api/axios.js` ตรงกับ backend และ login มี JWT ใน browser storage

### Port ถูกใช้งานแล้ว

ปิด process เก่าที่ใช้ port เดิม หรือกำหนด `PORT` ค่าอื่นใน backend `.env` แล้วปรับ API และ Socket URL ของ frontend ให้ตรงกัน

### `npm install` ล้มเหลวหลัง clone

ตรวจ internet access, Node/npm versions, ยืนยันว่าสั่งจาก root ที่มี root `package.json` และลองรัน `npm install` ใหม่ อย่าลบ package-lock โดยไม่จำเป็น เพราะ lockfile ช่วยให้ทีมติดตั้ง dependency versions ที่สอดคล้องกัน

## 10. สรุปคำสั่งที่ใช้บ่อย

| งาน | คำสั่ง (จาก repository root) |
|---|---|
| ติดตั้ง dependencies ทุก workspace | `npm install` |
| เปิด frontend + backend พร้อมกัน | `npm run dev` |
| เปิด backend อย่างเดียว | `npm run dev --workspace=backend` |
| เปิด frontend อย่างเดียว | `npm run dev --workspace=frontend` |
| Build frontend | `npm run build --workspace=frontend` |
| Lint frontend | `npm run lint --workspace=frontend` |
| รัน backend production | `npm start --workspace=backend` |
| Preview production build | `npm run preview --workspace=frontend` |
