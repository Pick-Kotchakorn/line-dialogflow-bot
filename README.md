# 🤖 LINE Dialogflow Bot

**สมาร์ทบอทสำหรับตอบข้อความอัตโนมัติผ่าน LINE Official Account**

## ✨ Features

- ✅ **เชื่อมต่อ LINE OA กับ Dialogflow**
- ✅ **แสดงสถานะ "กำลังพิมพ์"** แบบสมจริง
- ✅ **ตอบข้อความอัตโนมัติ** ผ่าน AI
- ✅ **Fallback responses** สำหรับกรณี AI ไม่พร้อม
- ✅ **Error handling** ครบถ้วน
- ✅ **Health monitoring** และ logs
- ✅ **Auto-deployment** จาก GitHub

## 🛠 Tech Stack

- **Backend**: Node.js + Express
- **Chat Platform**: LINE Bot SDK
- **AI Engine**: Google Dialogflow
- **Deployment**: Render
- **Version Control**: GitHub
- **Language**: JavaScript (ES6+)

## 🚀 Live Demo

- **Bot URL**: [line-dialogflow-bot-4kvp.onrender.com](https://line-dialogflow-bot-4kvp.onrender.com)
- **Health Check**: [/health](https://line-dialogflow-bot-4kvp.onrender.com/health)
- **Webhook**: [/webhook](https://line-dialogflow-bot-4kvp.onrender.com/webhook)

## 🔧 Environment Variables

ตั้งค่าใน Render Dashboard:

```env
# LINE Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# Google Cloud Configuration  
GOOGLE_PROJECT_ID=your_google_project_id
GOOGLE_APPLICATION_CREDENTIALS_JSON=your_service_account_json

# Optional
NODE_ENV=production
PORT=3000
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | หน้าหลักและข้อมูลบอท |
| `GET` | `/health` | ตรวจสอบสถานะระบบ |
| `GET` | `/webhook` | ทดสอบ webhook |
| `POST` | `/webhook` | รับข้อความจาก LINE |

## 🤖 Bot Capabilities

### **การตอบสนอง:**
- 💬 **ทักทาย**: "สวัสดี", "หวัดดี", "ดี"
- ❓ **ขอความช่วยเหลือ**: "ช่วย", "สอบถาม"  
- 👋 **ลาก่อน**: "บาย", "ขอบคุณ"
- 🧪 **ทดสอบ**: "ทดสอบ", "test"

### **ฟีเจอร์พิเศษ:**
- 💭 แสดงสถานะ "กำลังคิดคำตอบ..." ก่อนตอบ
- 🎲 ข้อความตอบกลับแบบสุ่ม
- 🛡️ Error handling แบบ graceful
- 📊 Logging และ monitoring

## 🔄 Deployment Process

### **Automatic Deployment:**
1. Push โค้ดไปยัง GitHub repository
2. Render detect การเปลี่ยนแปลงอัตโนมัติ
3. Build และ deploy ใหม่
4. Bot พร้อมใช้งานภายใน 2-3 นาที

### **Manual Deployment:**
```bash
# ใน Render Dashboard
Manual Deploy → Deploy Latest Commit
```

## 📱 LINE OA Setup

### **Webhook Configuration:**
```
Webhook URL: https://line-dialogflow-bot-4kvp.onrender.com/webhook
Use webhook: ✅ ON
Verify: ✅ Success
```

### **OA Features:**
```
Auto-reply messages: ❌ OFF
Greeting messages: ❌ OFF  
```

## 🧪 Testing

### **Health Check:**
```bash
curl https://line-dialogflow-bot-4kvp.onrender.com/health
```

### **Webhook Test:**
```bash
curl https://line-dialogflow-bot-4kvp.onrender.com/webhook
```

### **LINE Bot Test:**
1. เพิ่มเพื่อน LINE OA ผ่าน QR Code
2. ส่งข้อความ "สวัสดี"
3. ตรวจสอบการตอบสนอง

## 📊 Monitoring

### **Logs Location:**
- **Render Dashboard** → **Logs** tab
- Real-time log streaming
- Error tracking และ performance metrics

### **Key Metrics:**
- Response time
- Error rate  
- Memory usage
- Uptime

## 🔐 Security

- Environment variables สำหรับ sensitive data
- Input validation และ sanitization
- Error message ไม่เปิดเผยข้อมูลระบบ
- CORS headers สำหรับ API security

## 👨‍💻 Developer

**KOTCHAKORN YDM**  
- Project: LINE Dialogflow Bot
- Platform: Render + GitHub
- AI: Google Dialogflow

---

## 📝 Changelog

### **v1.0.0** (2025-07-11)
- ✅ Initial release
- ✅ LINE Bot integration  
- ✅ Dialogflow connection
- ✅ Typing status feature
- ✅ Fallback responses
- ✅ Auto-deployment setup

---

**🔗 Webhook URL**: `https://line-dialogflow-bot-4kvp.onrender.com/webhook`
