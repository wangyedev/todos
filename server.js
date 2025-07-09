const express = require('express');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Input validation schemas
const generateTasksSchema = Joi.object({
  text: Joi.string().min(1).max(1000).required()
});

// Utility function to handle API errors
const handleError = (res, error, message = 'Internal server error') => {
  console.error('API Error:', error);
  res.status(500).json({ 
    error: message,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// POST /api/transcribe-voice
app.post('/api/transcribe-voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Note: Google's Gemini models don't currently support direct audio transcription
    // This would typically use Google Cloud Speech-to-Text API
    // For now, we'll simulate transcription or use a placeholder
    
    // In a real implementation, you would use:
    // const speech = require('@google-cloud/speech');
    // const client = new speech.SpeechClient();
    
    // For demonstration, we'll return a placeholder response
    // In production, replace this with actual speech-to-text implementation
    
    res.status(501).json({ 
      error: 'Audio transcription not implemented',
      message: 'Please use text input for now. Audio transcription requires Google Cloud Speech-to-Text API setup.'
    });
    
  } catch (error) {
    handleError(res, error, 'Failed to transcribe audio');
  }
});

// POST /api/generate-tasks
app.post('/api/generate-tasks', async (req, res) => {
  try {
    // Validate input
    const { error, value } = generateTasksSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { text } = value;

    // Get Gemini model - using the latest version
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Craft the prompt for task extraction
    const prompt = `You are a hyper-efficient AI assistant. Your sole function is to analyze the user's command and extract all identifiable tasks. You must return these tasks in a valid JSON array of objects. Each object must contain a unique 'id' (a random number or timestamp) and a 'task' string. Do not add any conversational text or explanations to your response.

User command: "${text}"

Your response must be only the JSON output. Example format:
[
  {"id": 1720532709001, "task": "Email the team about the new project"},
  {"id": 1720532709002, "task": "Buy a birthday cake for Sarah"}
]

Return only the JSON array, no other text:`;

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    try {
      // Parse the JSON response
      const tasks = JSON.parse(generatedText);
      
      // Validate the response format
      if (!Array.isArray(tasks)) {
        throw new Error('Response is not an array');
      }

      // Ensure each task has the required fields
      const validatedTasks = tasks.map((task, index) => ({
        id: task.id || Date.now() + index,
        task: task.task || 'Untitled task',
        completed: false
      }));

      res.json(validatedTasks);

    } catch (parseError) {
      console.error('Failed to parse Gemini response:', generatedText);
      
      // Fallback: create a single task from the original text
      const fallbackTasks = [{
        id: Date.now(),
        task: text,
        completed: false
      }];
      
      res.json(fallbackTasks);
    }

  } catch (error) {
    handleError(res, error, 'Failed to generate tasks');
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'vob-backend'
  });
});

// List available models endpoint (for troubleshooting)
app.get('/api/models', async (req, res) => {
  try {
    const models = await genAI.listModels();
    res.json({ 
      models: models.map(model => ({ 
        name: model.name, 
        displayName: model.displayName,
        supportedGenerationMethods: model.supportedGenerationMethods 
      }))
    });
  } catch (error) {
    handleError(res, error, 'Failed to list models');
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check if API key is configured
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.warn('⚠️  GOOGLE_AI_API_KEY not configured. Please set it in your environment variables.');
  }
}); 