require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { SessionsClient } = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

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
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      sessionClient = new SessionsClient({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: credentials
      });
      dialogflowReady = true;
      console.log('✅ Dialogflow initialized with JSON credentials');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      sessionClient = new SessionsClient({
        projectId: process.env.GOOGLE_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
      dialogflowReady = true;
      console.log('✅ Dialogflow initialized with file credentials');
    } else {
      throw new Error('No Google credentials found');
    }
  } catch (error) {
    console.error('❌ Dialogflow initialization failed:', error.message);
    dialogflowReady = false;
  }
}

// Initialize on startup
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
    status: '🤖 LINE Dialogflow Bot - Real Loading Animation',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      lineBot: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      dialogflow: dialogflowReady,
      realLoadingAnimation: 'LINE Native Loading API',
      loadingDuration: '3 seconds',
      noSpamMessages: true
    },
    uptime: Math.floor(process.uptime()) + ' seconds'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      line: !!client,
      dialogflow: dialogflowReady,
      loadingAPI: 'Available',
      googleProject: process.env.GOOGLE_PROJECT_ID || 'not-set'
    }
  });
});

// 🎬 Loading Animation API Test Endpoint
app.post('/api/loading/test', async (req, res) => {
  const { userId, seconds = 5 } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      status: 'error',
      message: 'userId is required'
    });
  }

  try {
    const result = await showRealLoadingAnimation(userId, seconds);
    res.json({
      status: 'success',
      message: `Loading animation sent to user ${userId} for ${seconds} seconds`,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  console.log('🔍 Webhook verification received');
  res.status(200).send('Webhook ready with real LINE loading animation!');
});

// Main webhook endpoint
app.post('/webhook', async (req, res) => {
  console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));
  
  try {
    // ตรวจสอบว่ามี events หรือไม่
    if (!req.body.events || req.body.events.length === 0) {
      console.log('✅ Verification request - no events');
      return res.status(200).json({ message: 'OK' });
    }

    // ประมวลผล events
    const results = await Promise.all(
      req.body.events.map(event => handleEvent(event))
    );
    
    console.log('✅ All events processed');
    res.status(200).json({ message: 'OK', processed: results.length });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 🎬 Main event handler with Real Loading Animation
async function handleEvent(event) {
  console.log(`🔄 Event type: ${event.type}`);
  
  // จัดการเฉพาะข้อความที่เป็นข้อความ
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log('⏭️ Skipping non-text message');
    return null;
  }

  const { replyToken, source, message } = event;
  const userId = source.userId;
  const userMessage = message.text.trim();
  
  console.log(`👤 User ${userId}: "${userMessage}"`);

  try {
    // 🎬 Show Real LINE Loading Animation
    console.log('🎬 Starting real LINE loading animation...');
    const loadingSeconds = getLoadingDuration(userMessage);
    await showRealLoadingAnimation(userId, loadingSeconds);
    
    // 🤖 Process message with Dialogflow (during loading animation)
    console.log('🚀 Processing with Dialogflow...');
    const botResponse = await processWithDialogflow(userMessage, userId);
    
    // ⏰ รอให้ครบเวลาที่กำหนด (ถ้าประมวลผลเสร็จเร็วกว่า loading duration)
    await sleep(Math.max(0, loadingSeconds * 1000 - 1000)); // ลบ 1 วินาทีเพื่อให้ดูเป็นธรรมชาติ
    
    // 📤 Send final response (loading animation จะหายไปอัตโนมัติ)
    console.log(`📤 Sending response: "${botResponse}"`);
    await client.replyMessage(replyToken, {
      type: 'text',
      text: botResponse
    });
    
    console.log('✅ Message handled with real loading animation');
    return { 
      status: 'success', 
      userId: userId,
      input: userMessage,
      output: botResponse,
      loadingSeconds: loadingSeconds,
      animationType: 'real-line-loading'
    };
    
  } catch (error) {
    console.error('❌ Error handling message:', error);
    
    // Error fallback
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

// 🎯 Determine loading duration based on message complexity
function getLoadingDuration(message) {
  const messageLength = message.length;
  
  // ข้อความสั้น: 3 วินาที
  if (messageLength <= 10) return 3;
  
  // ข้อความปานกลาง: 4 วินาที  
  if (messageLength <= 30) return 4;
  
  // ข้อความยาว: 5 วินาที
  if (messageLength <= 100) return 5;
  
  // ข้อความยาวมาก: 6 วินาที
  return 6;
}

// 🎬 Real LINE Loading Animation Function
async function showRealLoadingAnimation(userId, loadingSeconds = 3) {
  try {
    console.log(`🎬 Showing real loading animation for ${loadingSeconds} seconds...`);
    
    const response = await axios.post('https://api.line.me/v2/bot/chat/loading/start', {
      chatId: userId,
      loadingSeconds: loadingSeconds
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    });
    
    console.log(`✅ Real loading animation started successfully`);
    console.log(`⏰ Duration: ${loadingSeconds} seconds`);
    
    return {
      success: true,
      duration: loadingSeconds,
      response: response.status
    };
    
  } catch (error) {
    console.error('❌ Failed to show real loading animation:', error.response?.data || error.message);
    
    // Fallback: ถ้า loading animation ไม่ทำงาน ให้ใช้ delay ธรรมดา
    console.log('🔄 Falling back to simple delay...');
    await sleep(loadingSeconds * 1000);
    
    return {
      success: false,
      fallback: true,
      duration: loadingSeconds,
      error: error.response?.data || error.message
    };
  }
}

// 🧠 Process message with Dialogflow
async function processWithDialogflow(message, userId) {
  if (!dialogflowReady || !sessionClient) {
    console.log('⚠️ Dialogflow not ready, using fallback');
    return getFallbackResponse(message);
  }
  
  try {
    const dialogflowResponse = await queryDialogflow(message, userId);
    
    if (dialogflowResponse && dialogflowResponse.trim()) {
      return dialogflowResponse;
    } else {
      console.log('⚠️ Empty Dialogflow response, using fallback');
      return getFallbackResponse(message);
    }
    
  } catch (error) {
    console.error('❌ Dialogflow query failed:', error);
    return getFallbackResponse(message);
  }
}

// 🔗 Query Dialogflow
async function queryDialogflow(message, sessionId) {
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

    console.log(`🚀 Dialogflow query: "${message}"`);
    
    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;
    
    console.log(`📥 Intent: "${result.intent?.displayName || 'Default Fallback'}"`);
    console.log(`📤 Response: "${result.fulfillmentText}"`);
    console.log(`🎯 Confidence: ${result.intentDetectionConfidence || 0}`);
    
    return result.fulfillmentText;
    
  } catch (error) {
    console.error('❌ Dialogflow API error:', error);
    throw error;
  }
}

// 🛡️ Fallback response
function getFallbackResponse(message) {
  console.log(`🔄 Using fallback response for: "${message}"`);
  
  const lowerMessage = message.toLowerCase();
  
  // Loading animation info
  if (lowerMessage.includes('loading') || lowerMessage.includes('โหลด')) {
    return '🎬 ระบบใช้ Loading Animation จริงจาก LINE แล้ว!\n\n✅ ไม่มีข้อความสปาม\n✅ Animation แบบ Native\n✅ หายไปอัตโนมัติ\n✅ UX ดีขึ้นมาก\n\nลองส่งข้อความยาวๆ ดูครับ จะโหลดนานขึ้น! 🚀';
  }
  
  // Basic responses
  if (lowerMessage.includes('สวัสดี') || lowerMessage.includes('หวัดดี') || lowerMessage.includes('hello')) {
    return '🤖 สวัสดีครับ! ระบบใช้ Loading Animation จริงจาก LINE API แล้ว\n\nคุณเห็น loading animation ที่เป็นแบบ native ของ LINE หรือไม่? ไม่มีข้อความสปามแล้วครับ! ✨';
  }
  
  if (lowerMessage.includes('ทดสอบ') || lowerMessage.includes('test')) {
    return '🎬 ระบบ Real Loading Animation ทำงานแล้ว!\n\n✅ LINE Native Loading: ใช้งานได้\n✅ Auto Duration: 3-6 วินาที\n✅ No Spam Messages: สะอาด\n✅ Dialogflow: ' + (dialogflowReady ? 'พร้อม' : 'Fallback') + '\n\nทุกอย่างเพอร์เฟค! 🚀';
  }
  
  if (lowerMessage.includes('เชื่อมต่อ')) {
    return '🔗 ระบบเชื่อมต่อสำเร็จ!\n\n• Dialogflow: ' + (dialogflowReady ? '✅ พร้อม' : '⚠️ ไม่พร้อม') + '\n• LINE Loading API: ✅ ทำงาน\n• Real Animation: ✅ Native\n\nไม่มีข้อความสปามอีกแล้วครับ! 🎉';
  }
  
  // Default with duration hint
  const duration = getLoadingDuration(message);
  return `📨 ได้รับข้อความ "${message}" แล้วครับ!\n\n🎬 คุณเห็น Loading Animation จริงๆ จาก LINE หรือไม่?\n⏰ Duration: ${duration} วินาที\n\nลองส่งข้อความยาวๆ ดู จะโหลดนานขึ้นครับ! ✨`;
}

// ⏰ Utility function: sleep
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
    message: 'Endpoint not found',
    availableEndpoints: {
      'GET /': 'Bot information',
      'GET /health': 'Health check',
      'POST /api/loading/test': 'Test real loading animation',
      'GET /webhook': 'Webhook verification',
      'POST /webhook': 'LINE webhook'
    }
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 =====================================');
  console.log(`🤖 LINE Dialogflow Bot - Real Loading`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎬 Loading: LINE Native API`);
  console.log(`⏰ Duration: 3-6 seconds (auto)`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log('🚀 =====================================');
  
  validateEnvironment();
});

// Validate environment variables
function validateEnvironment() {
  const required = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'GOOGLE_PROJECT_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('⚠️  Missing required environment variables:');
    missing.forEach(key => console.log(`   ❌ ${key}`));
  } else {
    console.log('✅ All required environment variables are set');
  }
  
  console.log(`🎯 Google Cloud Project: ${process.env.GOOGLE_PROJECT_ID || 'Not set'}`);
  console.log('🎬 Real Loading Animation API: Ready');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  server.close(() => {
    console.log('🔴 Server closed');
    process.exit(0);
  });
});

module.exports = app;
