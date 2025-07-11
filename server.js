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
const sessionClient = new SessionsClient({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const client = new line.Client(config);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'LINE Dialogflow Bot is running!', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Webhook endpoint
app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('📨 Received webhook:', JSON.stringify(req.body, null, 2));
  
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => {
      console.log('✅ Webhook processed successfully');
      res.json(result);
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
    '🔍 กำลังค้นหาข้อมูล...'
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
    
    console.log(`📥 Dialogflow detected intent: "${result.intent.displayName}"`);
    console.log(`📤 Dialogflow response: "${result.fulfillmentText}"`);
    
    // ถ้าไม่มีคำตอบจาก Dialogflow
    if (!result.fulfillmentText) {
      return 'ขออภัยครับ ผมไม่เข้าใจคำถามของคุณ กรุณาลองถามใหม่อีกครั้ง 🤔';
    }
    
    return result.fulfillmentText;
    
  } catch (error) {
    console.error('❌ Error sending to Dialogflow:', error);
    
    // ตรวจสอบประเภทของ error
    if (error.code === 'ENOENT') {
      throw new Error('Service Account Key file not found. Please check GOOGLE_APPLICATION_CREDENTIALS path.');
    } else if (error.code === 3) {
      throw new Error('Invalid Google Cloud Project ID or Dialogflow not enabled.');
    } else if (error.code === 7) {
      throw new Error('Permission denied. Please check Service Account permissions.');
    }
    
    throw error;
  }
}

// ฟังก์ชันส่ง Rich Message (เสริม)
async function sendRichMessage(userId, type = 'menu') {
  const richMessages = {
    menu: {
      type: 'template',
      altText: 'เมนูหลัก',
      template: {
        type: 'buttons',
        text: 'เลือกหัวข้อที่ต้องการสอบถาม',
        actions: [
          {
            type: 'message',
            label: '📋 ข้อมูลทั่วไป',
            text: 'ข้อมูลทั่วไป'
          },
          {
            type: 'message',
            label: '📞 ติดต่อเจ้าหน้าที่',
            text: 'ติดต่อเจ้าหน้าที่'
          },
          {
            type: 'message',
            label: '❓ คำถามที่พบบ่อย',
            text: 'คำถามที่พบบ่อย'
          }
        ]
      }
    },
    greeting: {
      type: 'template',
      altText: 'สวัสดีครับ!',
      template: {
        type: 'buttons',
        text: 'สวัสดีครับ! ยินดีให้บริการ',
        actions: [
          {
            type: 'message',
            label: '🚀 เริ่มต้นใช้งาน',
            text: 'เริ่มต้นใช้งาน'
          }
        ]
      }
    }
  };
  
  try {
    await client.pushMessage(userId, richMessages[type]);
    console.log(`📋 Sent rich message: ${type}`);
  } catch (error) {
    console.error('❌ Error sending rich message:', error);
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: error.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 ====================================');
  console.log(`🤖 LINE Dialogflow Bot Server Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
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
    'GOOGLE_PROJECT_ID',
    'GOOGLE_APPLICATION_CREDENTIALS'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('⚠️  WARNING: Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`   ❌ ${varName}`);
    });
    console.log('   Please check your .env file');
  } else {
    console.log('✅ All environment variables are set');
  }
}