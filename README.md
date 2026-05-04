"# sun-planner" 
docker-compose up -d

cd backend
npm install
npm run start:dev

cd frontend
npm install
npm run dev

## 🚀 Deployment (Production)

### Backend (Server)
เราใช้ **PM2** ในการรัน Backend บน Server เพื่อให้ทำงานอยู่เบื้องหลังเสมอ และรีสตาร์ทอัตโนมัติหากมีปัญหา

1. ติดตั้ง PM2 (ถ้ายังไม่มี):
   ```bash
   npm install -g pm2
   ```
2. บิลด์โปรเจกต์:
   ```bash
   cd backend
   npm run build
   ```
3. สตาร์ท Backend ด้วย PM2 (ใช้โหมด Production):
   ```bash
   pm2 start ecosystem.config.js --env production
   ```
4. คำสั่งจัดการ PM2 เบื้องต้น:
   - ดูสถานะ: `pm2 status`
   - ดู Logs (เช่น เวลามี Error ดึงข้อมูลจาก ERP): `pm2 logs sun-planner-backend`
   - สตาร์ทรอบใหม่ (กรณีแก้โค้ด): `pm2 restart sun-planner-backend`
