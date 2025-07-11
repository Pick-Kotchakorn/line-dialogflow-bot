# LINE Dialogflow Bot

🤖 Bot สำหรับตอบข้อความอัตโนมัติผ่าน LINE Official Account

## ✨ Features

- ✅ เชื่อมต่อ LINE OA กับ Dialogflow
- ✅ แสดงสถานะ "กำลังพิมพ์"
- ✅ ตอบข้อความอัตโนมัติ
- ✅ Error handling ครบถ้วน
- ✅ Health check endpoint

## 🛠 Tech Stack

- **Backend**: Node.js + Express
- **Chat Platform**: LINE Bot SDK
- **AI**: Google Dialogflow
- **Deployment**: Render
- **Version Control**: GitHub

## 🚀 Deployment

Deploy ด้วย Render ผ่าน GitHub integration

### Environment Variables

```env
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx
GOOGLE_PROJECT_ID=xxx
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/service-account-key.json
```

## 📡 Endpoints

- `GET /` - หน้าหลัก
- `GET /health` - Health check
- `POST /webhook` - LINE webhook
- `GET /webhook` - Webhook verification

## 👨‍💻 Author

**KOTCHAKORN YDM**

---

🔗 **Webhook URL**: `https://your-app.onrender.com/webhook`