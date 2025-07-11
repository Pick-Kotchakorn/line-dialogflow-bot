require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { SessionsClient } = require('@google-cloud/dialogflow');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// LINE Bot Configuration
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// Dialogflow Configuration
let sessionClient;

// ตรวจสอบว่าใช้ JSON จาก Environment Variable หรือไฟล์
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  // วิธีที่ 1: ใช้ JSON จาก Environment Variable
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  sessionClient = new SessionsClient({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: credentials
  });
  console.log('🔑 Using credentials from Environment Variable');
} else {
  // วิธีที่ 2: ใช้ไฟล์ (fallback)
  sessionClient = new SessionsClient({
    projectId: process.env.GOOGLE_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
  console.log('🔑 Using credentials from file');
}

const client = new line.Client(config);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Security headers for production
app.use((req, res, next) => {
  res.header('X-Frame-Options', 'DENY');
  res.header('X-Content-Type-Options', 'nosniff');
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: '🤖 LINE Dialogflow Bot is running!', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(process.uptime())} seconds`
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Webhook verification endpoint (for LINE verification)
app.get('/webhook', (req, res) => {
  console.log('🔍 Webhook verification request received');
  res.status(200).send('Webhook verification successful');
});

// Webhook endpoint
app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('📨 Received webhook:', JSON.stringify(req.body, null, 2));
  
  // ตรวจสอบว่าเป็น verification request หรือไม่
  if (!req.body.events || req.body.events.length === 0) {
    console.log('✅ Verification request received');
    return res.status(200).json({ message: 'OK' });
  }
  
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => {
      console.log('✅ Webhook processed successfully');
      res.status(200).json(result);
    })
    .catch((error) => {
      console.error('❌ Error handling webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
});

// Main event handler
async function handleEvent(event) {
  console.log('🔄 Handling event:', event.type);
  
  // จัดการเฉพาะข้อความที่เป็นตัวอักษร
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log('⏭️ Skipping non-text message');
    return Promise.resolve(null);
  }

  const userId = event.source.userId;
  const userMessage = event.message.text;
  console.log(`👤 User ${userId} said: "${userMessage}"`);
  
  try {
    // แสดงสถานะ "กำลังพิมพ์"
    await showTypingStatus(userId);
    
    // ส่งข้อความไป Dialogflow
    const dialogflowResponse = await sendToDialogflow(userMessage, userId);
    console.log(`🤖 Bot response: "${dialogflowResponse}"`);
    
    // ตอบกลับผู้ใช้
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: dialogflowResponse
    });
    
  } catch (error) {
    console.error('❌ Error in handleEvent:', error);
    
    // ส่งข้อความแจ้งข้อผิดพลาด
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ขออภัยครับ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง 🙏'
    });
  }
}

// ฟังก์ชันแสดงสถานะกำลังพิมพ์
async function showTypingStatus(userId) {
  const typingMessages = [
    '💭 กำลังคิดคำตอบ...',
    '🤔 กำลังวิเคราะห์...',
    '⚡ กำลังประมวลผล...',
    '🔍 กำลังค้นหาข้อมูล...',
    '🧠 กำลังใช้ AI คิด...'
  ];
  
  const randomMessage = typingMessages[Math.floor(Math.random() * typingMessages.length)];
  
  try {
    // ส่งข้อความแสดงสถานะ
    await client.pushMessage(userId, {
      type: 'text',
      text: randomMessage
    });
    
    // รอสักครู่เพื่อให้ดูเป็นธรรมชาติ
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`💬 Showed typing status: "${randomMessage}"`);
    
  } catch (error) {
    console.error('❌ Error showing typing status:', error);
  }
}

// ฟังก์ชันส่งข้อความไป Dialogflow
async function sendToDialogflow(message, sessionId) {
  try {
    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.GOOGLE_PROJECT_ID,
      sessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: message,
          languageCode: 'th-TH', // ภาษาไทย
        },
      },
    };

    console.log(`🚀 Sending to Dialogflow: "${message}"`);
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;
    
    console.log(`📥 Dialogflow detected intent: "${result.intent?.displayName || 'Unknown'}"`);
    console.log(`📤 Dialogflow response: "${result.fulfillmentText}"`);
    
    // ถ้าไม่มีคำตอบจาก Dialogflow
    if (!result.fulfillmentText) {
      return 'ขออภัยครับ ผมไม่เข้าใจคำถามของคุณ กรุณาลองถามใหม่อีกครั้ง 🤔\n\nลองพิมพ์ "สวัสดี" หรือ "ช่วยเหลือ" ดูครับ';
    }
    
    return result.fulfillmentText;
    
  } catch (error) {
    console.error('❌ Error sending to Dialogflow:', error);
    
    // ตรวจสอบประเภทของ error
    if (error.code === 'ENOENT') {
      console.error('Service Account Key file not found');
      return 'ขออภัยครับ เกิดปัญหาเกี่ยวกับการตั้งค่าระบบ (Service Account Key not found)';
    } else if (error.code === 3) {
      console.error('Invalid Google Cloud Project ID or Dialogflow not enabled');
      return 'ขออภัยครับ เกิดปัญหาเกี่ยวกับการเชื่อมต่อ Dialogflow';
    } else if (error.code === 7) {
      console.error('Permission denied. Check Service Account permissions');
      return 'ขออภัยครับ เกิดปัญหาเกี่ยวกับสิทธิ์การเข้าถึง';
    }
    
    return 'ขออภัยครับ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง 🙏';
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 ====================================');
  console.log(`🤖 LINE Dialogflow Bot Server Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log('🚀 ====================================');
  
  // ตรวจสอบ Environment Variables
  checkEnvironmentVariables();
});

// ฟังก์ชันตรวจสอบ Environment Variables
function checkEnvironmentVariables() {
  const requiredVars = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET', 
    'GOOGLE_PROJECT_ID'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('⚠️  WARNING: Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`   ❌ ${varName}`);
    });
    console.log('   Please check your environment settings');
  } else {
    console.log('✅ All environment variables are set');
  }
  
  // ตรวจสอบ Google Credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.log('✅ Google credentials loaded from JSON environment variable');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('✅ Google credentials loaded from file path');
  } else {
    console.log('⚠️  WARNING: No Google credentials found');
  }
}
