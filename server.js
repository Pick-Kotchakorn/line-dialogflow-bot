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
    status: '🤖 LINE Dialogflow Bot - Clean Typing Version',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    features: {
      lineBot: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      dialogflow: dialogflowReady,
      typingDelay: '2.5 seconds',
      cleanResponse: true
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
      googleProject: process.env.GOOGLE_PROJECT_ID || 'not-set'
    }
  });
});

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  console.log('🔍 Webhook verification received');
  res.status(200).send('Webhook is ready for LINE messages!');
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

// 🎯 Main event handler - Clean version with typing delay
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
    // 🕐 Simulate typing delay (2.5 seconds)
    console.log('💭 Simulating typing delay...');
    await sleep(2500);
    
    // 🤖 Process message with Dialogflow
    console.log('🚀 Querying Dialogflow...');
    const botResponse = await processWithDialogflow(userMessage, userId);
    
    // 📤 Reply immediately (no status messages)
    console.log(`📤 Replying: "${botResponse}"`);
    await client.replyMessage(replyToken, {
      type: 'text',
      text: botResponse
    });
    
    console.log('✅ Message handled successfully');
    return { 
      status: 'success', 
      userId: userId,
      input: userMessage,
      output: botResponse 
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
    console.log(`🎯 Project: ${process.env.GOOGLE_PROJECT_ID}`);
    console.log(`🔑 Session: ${sessionId}`);
    
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

// 🛡️ Fallback response (backup when Dialogflow fails)
function getFallbackResponse(message) {
  console.log(`🔄 Using fallback response for: "${message}"`);
  
  const lowerMessage = message.toLowerCase();
  
  // Basic keyword matching for testing
  if (lowerMessage.includes('สวัสดี') || lowerMessage.includes('หวัดดี') || lowerMessage.includes('hello')) {
    return 'สวัสดีครับ! ระบบทำงานปกติ ขณะนี้เชื่อมต่อกับ Dialogflow แล้วครับ 🤖';
  }
  
  if (lowerMessage.includes('ทดสอบ') || lowerMessage.includes('test')) {
    return 'ระบบพร้อมใช้งานครับ! ✅\n\n• Dialogflow: ' + (dialogflowReady ? 'เชื่อมต่อแล้ว' : 'ไม่พร้อม') + '\n• Typing delay: 2.5 วินาที\n• Response: ทำงานปกติ';
  }
  
  // Default fallback
  return `ได้รับข้อความ "${message}" แล้วครับ!\n\nหากคุณเห็นข้อความนี้ แสดงว่า Dialogflow อาจยังไม่มี Intent ที่ตรงกับคำถามของคุณ\n\nลองพิมพ์ "เชื่อมต่อ" เพื่อทดสอบ Intent ที่ตั้งค่าไว้ครับ 😊`;
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
      'GET /webhook': 'Webhook verification',
      'POST /webhook': 'LINE webhook'
    }
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 =====================================');
  console.log(`🤖 LINE Dialogflow Bot - Clean Version`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Typing delay: 2.5 seconds`);
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
    console.log('   Please set these in Render dashboard');
  } else {
    console.log('✅ All required environment variables are set');
  }
  
  // Check Dialogflow credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.log('✅ Dialogflow: JSON credentials found');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('✅ Dialogflow: File path credentials found');
  } else {
    console.log('⚠️  Dialogflow: No credentials found - will use fallback responses');
  }
  
  console.log(`🎯 Google Cloud Project: ${process.env.GOOGLE_PROJECT_ID || 'Not set'}`);
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
