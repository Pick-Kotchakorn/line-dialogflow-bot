require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { SessionsClient } = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// LINE Bot Configuration
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(lineConfig);

// Dialogflow Configuration
let sessionClient = null;
let dialogflowReady = false;

// Initialize Dialogflow
async function initializeDialogflow() {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // ใช้ JSON credentials จาก environment variable
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      sessionClient = new SessionsClient({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: credentials
      });
      dialogflowReady = true;
      console.log('✅ Dialogflow initialized from JSON credentials');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // ใช้ไฟล์ credentials
      sessionClient = new SessionsClient({
        projectId: process.env.GOOGLE_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
      dialogflowReady = true;
      console.log('✅ Dialogflow initialized from file credentials');
    } else {
      throw new Error('No Google credentials found');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Dialogflow:', error.message);
    dialogflowReady = false;
  }
}

// Initialize Dialogflow on startup
initializeDialogflow();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: '🤖 LINE Dialogflow Bot is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: {
      lineBot: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      dialogflow: dialogflowReady,
      typingStatus: true,
      autoReply: true
    },
    uptime: Math.floor(process.uptime()) + ' seconds'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      line: !!client,
      dialogflow: dialogflowReady
    }
  };
  res.json(health);
});

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  console.log('🔍 GET Webhook verification received');
  res.status(200).send('Webhook endpoint is working!');
});

// Webhook endpoint for LINE
app.post('/webhook', async (req, res) => {
  console.log('📨 POST Webhook received:', JSON.stringify(req.body, null, 2));
  
  try {
    const signature = req.get('X-Line-Signature');
    console.log('🔐 Signature received:', signature ? 'Yes' : 'No');
    
    // ตรวจสอบว่ามี events หรือไม่
    if (!req.body.events) {
      console.log('✅ No events found - verification request');
      return res.status(200).json({ message: 'OK' });
    }

    // ประมวลผล events ทั้งหมด
    const results = await Promise.all(
      req.body.events.map(event => handleEvent(event))
    );
    
    console.log('✅ All events processed successfully');
    res.status(200).json({ message: 'OK', results });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Main event handler
async function handleEvent(event) {
  console.log(`🔄 Processing event: ${event.type}`);
  
  // จัดการเฉพาะข้อความที่เป็นข้อความ
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log('⏭️ Skipping non-text message');
    return null;
  }

  const { replyToken, source, message } = event;
  const userId = source.userId;
  const userMessage = message.text.trim();
  
  console.log(`👤 User ${userId} said: "${userMessage}"`);

  try {
    // ขั้นตอนที่ 1: แสดงสถานะกำลังพิมพ์
    console.log('💭 Sending typing status...');
    await sendTypingStatus(userId);
    
    // ขั้นตอนที่ 2: รอสักครู่เพื่อให้ดูเป็นธรรมชาติ
    await sleep(1500);
    
    // ขั้นตอนที่ 3: ประมวลผลข้อความและตอบกลับ
    console.log('🤖 Processing message...');
    const botResponse = await processMessage(userMessage, userId);
    
    // ขั้นตอนที่ 4: ส่งคำตอบกลับผู้ใช้
    console.log(`📤 Replying: "${botResponse}"`);
    await client.replyMessage(replyToken, {
      type: 'text',
      text: botResponse
    });
    
    console.log('✅ Event handled successfully');
    return { status: 'success', userId, message: userMessage };
    
  } catch (error) {
    console.error('❌ Error handling event:', error);
    
    // ส่งข้อความแจ้งข้อผิดพลาด
    try {
      await client.replyMessage(replyToken, {
        type: 'text',
        text: 'ขออภัยครับ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งครับ 🙏'
      });
    } catch (replyError) {
      console.error('❌ Failed to send error message:', replyError);
    }
    
    return { status: 'error', error: error.message };
  }
}

// ฟังก์ชันแสดงสถานะกำลังพิมพ์
async function sendTypingStatus(userId) {
  const typingMessages = [
    '💭 กำลังคิดคำตอบ...',
    '🤔 กำลังวิเคราะห์คำถาม...',
    '⚡ กำลังประมวลผล...',
    '🔍 กำลังค้นหาข้อมูล...',
    '🧠 กำลังใช้ AI คิด...',
    '✨ กำลังเตรียมคำตอบ...'
  ];
  
  const randomMessage = typingMessages[Math.floor(Math.random() * typingMessages.length)];
  
  try {
    await client.pushMessage(userId, {
      type: 'text',
      text: randomMessage
    });
    console.log(`💬 Typing status sent: "${randomMessage}"`);
  } catch (error) {
    console.error('❌ Failed to send typing status:', error);
  }
}

// ฟังก์ชันประมวลผลข้อความ
async function processMessage(message, userId) {
  // ลองใช้ Dialogflow ก่อน
  if (dialogflowReady) {
    try {
      const dialogflowResponse = await queryDialogflow(message, userId);
      if (dialogflowResponse && dialogflowResponse.trim()) {
        return dialogflowResponse;
      }
    } catch (error) {
      console.error('❌ Dialogflow error:', error);
    }
  }
  
  // ใช้ fallback responses ถ้า Dialogflow ไม่ทำงาน
  return getFallbackResponse(message);
}

// ฟังก์ชันเชื่อมต่อ Dialogflow
async function queryDialogflow(message, sessionId) {
  if (!sessionClient || !dialogflowReady) {
    throw new Error('Dialogflow not initialized');
  }
  
  try {
    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.GOOGLE_PROJECT_ID,
      sessionId || uuidv4()
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: message,
          languageCode: 'th-TH'
        }
      }
    };

    console.log(`🚀 Querying Dialogflow: "${message}"`);
    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;
    
    console.log(`📥 Intent detected: "${result.intent?.displayName || 'Unknown'}"`);
    console.log(`📤 Dialogflow response: "${result.fulfillmentText}"`);
    
    return result.fulfillmentText || null;
    
  } catch (error) {
    console.error('❌ Dialogflow query error:', error);
    throw error;
  }
}

// ฟังก์ชันตอบกลับแบบ fallback
function getFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  // คำทักทาย
  if (lowerMessage.includes('สวัสดี') || lowerMessage.includes('หวัดดี') || 
      lowerMessage.includes('ดี') || lowerMessage.includes('hello') || 
      lowerMessage.includes('hi')) {
    return '🤖 สวัสดีครับ! ผมคือ Yondaime Bot ยินดีให้บริการครับ\n\nคุณสามารถสอบถามข้อมูลหรือขอความช่วยเหลือจากผมได้เลยครับ 😊';
  }
  
  // คำถามขอความช่วยเหลือ
  if (lowerMessage.includes('ช่วย') || lowerMessage.includes('help') || 
      lowerMessage.includes('สอบถาม') || lowerMessage.includes('ขอข้อมูล')) {
    return '📋 ผมสามารถช่วยเหลือคุณได้ในเรื่องต่างๆ เช่น:\n\n• ตอบคำถามทั่วไป\n• ให้ข้อมูลและคำแนะนำ\n• แชทคุยเป็นเพื่อน\n\nลองถามผมดูสิครับ! 💪';
  }
  
  // คำลา
  if (lowerMessage.includes('บาย') || lowerMessage.includes('ลาก่อน') || 
      lowerMessage.includes('ไปก่อน') || lowerMessage.includes('ขอบคุณ')) {
    return '🙏 ขอบคุณครับ! หวังว่าจะได้ช่วยเหลือคุณอีกครับ\n\nมีอะไรก็กลับมาคุยกันใหม่นะครับ ดูแลตัวเองด้วยครับ! 😊';
  }
  
  // การทดสอบ
  if (lowerMessage.includes('ทดสอบ') || lowerMessage.includes('test')) {
    return '✅ ระบบทำงานปกติครับ!\n\n🤖 Bot Status: Online\n⚡ Response Time: Fast\n🌐 Server: Render\n📡 Connection: Stable\n\nพร้อมให้บริการครับ! 💪';
  }
  
  // ตอบกลับแบบทั่วไป
  const generalResponses = [
    `🤖 ได้รับข้อความ "${message}" แล้วครับ!\n\nขณะนี้ระบบ AI กำลังเรียนรู้ ผมจึงยังตอบคำถามซับซ้อนไม่ได้ดีเท่าที่ควร\n\nลองถาม "ช่วยเหลือ" เพื่อดูสิ่งที่ผมทำได้ครับ 😊`,
    
    `💭 เข้าใจแล้วครับ คุณพูดว่า "${message}"\n\nผมกำลังพัฒนาความสามารถในการเข้าใจภาษาอยู่ครับ ขออภัยถ้าตอบไม่ตรงประเด็น\n\nมีอะไรอื่นให้ช่วยไหมครับ? 🤔`,
    
    `🎯 ขอบคุณสำหรับข้อความ "${message}" ครับ!\n\nผมยังเป็น AI ที่กำลังเรียนรู้ อาจตอบไม่ครบถ้วนในบางเรื่อง\n\nลองถามง่ายๆ หรือทักทาย "สวัสดี" ดูครับ! ☺️`
  ];
  
  return generalResponses[Math.floor(Math.random() * generalResponses.length)];
}

// Utility function: sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: ['/', '/health', '/webhook']
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 =====================================');
  console.log(`🤖 LINE Dialogflow Bot Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log('🚀 =====================================');
  
  // ตรวจสอบ Environment Variables
  validateEnvironment();
});

// ฟังก์ชันตรวจสอบ Environment Variables
function validateEnvironment() {
  const required = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'GOOGLE_PROJECT_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('⚠️  Missing environment variables:');
    missing.forEach(key => console.log(`   ❌ ${key}`));
  } else {
    console.log('✅ All required environment variables are set');
  }
  
  // ตรวจสอบ Dialogflow credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.log('✅ Dialogflow credentials: JSON format');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('✅ Dialogflow credentials: File path');
  } else {
    console.log('⚠️  No Dialogflow credentials found - using fallback responses');
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('🔴 Process terminated');
    process.exit(0);
  });
});

module.exports = app;
