# VOB - AI-Powered Task Management Agent

A sophisticated full-stack application that acts as an AI-powered agent for task management, powered by Google's Gemini models.

## 🏗️ Architecture

### Frontend (React + TypeScript)

- **React 18** with functional components and hooks
- **TypeScript** for type safety
- **Modern CSS** with gradients and animations
- **MediaRecorder API** for audio recording
- **Responsive design** for mobile and desktop

### Backend (Node.js + Express)

- **Express.js** server with REST API
- **Google Generative AI SDK** for Gemini integration
- **Multer** for file upload handling
- **Rate limiting** and security middleware
- **Input validation** with Joi

### AI Integration (Google Gemini)

- **Gemini 2.5 Flash** model for task generation
- **Speech-to-Text** using Gemini 2.5 Flash audio capabilities
- **Prompt engineering** for structured output

## 🚀 Features

### Core Functionality

- ✅ Text input for task generation
- 🎤 Voice recording and transcription with Gemini 2.5 Flash
- 🤖 AI-powered task extraction using Gemini 2.5 Flash
- 📋 Interactive task management (complete/delete)
- 📱 Responsive design for all devices

### User Interface

- 🎨 Modern glassmorphism design
- 🌈 Gradient backgrounds and smooth animations
- 🎯 Intuitive user experience
- ⚡ Real-time loading states and feedback
- 🔄 Error handling and recovery

## 📁 Project Structure

```
vob/
├── backend/
│   ├── server.js           # Express server with API endpoints
│   ├── package.json        # Backend dependencies
│   └── .env               # Environment variables (create this)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioRecorder.tsx      # Voice recording component
│   │   │   ├── AgentInteraction.tsx   # Main interaction interface
│   │   │   └── TodoList.tsx          # Task display and management
│   │   ├── services/
│   │   │   └── api.ts                # API communication layer
│   │   ├── types.ts                  # TypeScript type definitions
│   │   ├── App.tsx                   # Main app component
│   │   ├── App.css                   # Component styles
│   │   ├── index.tsx                 # React entry point
│   │   └── index.css                 # Global styles
│   ├── public/
│   │   └── index.html                # HTML template
│   ├── package.json                  # Frontend dependencies
│   └── tsconfig.json                 # TypeScript configuration
└── README.md                         # This file
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Google AI API key (get from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Backend Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:

   ```env
   GOOGLE_AI_API_KEY=your_google_ai_api_key_here
   PORT=8000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

3. **Start the backend server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm start
   ```

4. **Open your browser:**
   Go to `http://localhost:3000`

## 📱 Usage Guide

### Text Input

1. Type your tasks in the text area
2. Example: "I need to email the team, buy groceries, and call the doctor"
3. Click "Generate Tasks" to process with AI
4. View extracted tasks in the todo list below

### Voice Input

1. Click the "Record Voice" button
2. Speak your tasks clearly
3. Click "Stop Recording" when done
4. Audio will be transcribed by Gemini 2.5 Flash and converted to tasks automatically

### Task Management

- ✅ **Complete tasks:** Click the circle button next to a task
- 🗑️ **Delete tasks:** Click the trash icon
- 🧹 **Clear completed:** Remove all completed tasks
- 🔄 **Clear all:** Remove all tasks

## 🔧 Configuration

### Google AI API Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `GOOGLE_AI_API_KEY`

### Audio Format Support

Gemini 2.5 Flash supports various audio formats:

- **Supported formats:** WAV, MP3, FLAC, AAC, OGG, WEBM
- **Maximum duration:** ~10 minutes per audio file
- **File size limit:** 10MB per upload

## 🎯 AI Prompt Engineering

The application uses carefully crafted prompts to ensure consistent JSON output from Gemini 2.5 Flash:

```javascript
const prompt = `You are a hyper-efficient AI assistant. Your sole function is to analyze the user's command and extract all identifiable tasks. You must return these tasks in a valid JSON array of objects. Each object must contain a unique 'id' (a random number or timestamp) and a 'task' string. Do not add any conversational text or explanations to your response.

User command: "${text}"

Your response must be only the JSON output...`;
```

## 🚨 Known Limitations

1. **Task Persistence:** Tasks are stored in memory only (no database)
2. **User Authentication:** No user system implemented
3. **Rate Limiting:** Basic rate limiting implemented
4. **Audio File Size:** Limited to 10MB per audio file

## 🛡️ Security Features

- Environment variable protection for API keys
- Input validation with Joi
- Rate limiting to prevent abuse
- CORS configuration for frontend access
- Error handling without exposing sensitive information

## 🎨 Design Features

- **Glassmorphism UI** with backdrop blur effects
- **Gradient backgrounds** for visual appeal
- **Smooth animations** and transitions
- **Loading states** and error feedback
- **Responsive design** for all screen sizes
- **Accessibility** features (ARIA labels, keyboard navigation)

## 🔮 Future Enhancements

- [ ] Task persistence with database
- [ ] User authentication and profiles
- [ ] Task scheduling and reminders
- [ ] Export/import functionality
- [ ] Team collaboration features
- [ ] Mobile app version
- [ ] Offline support with service workers
- [ ] Support for longer audio files (>10 minutes)
- [ ] Real-time voice transcription

## 🐛 Troubleshooting

### Common Issues

1. **"Cannot find module 'react'"** - Install frontend dependencies with `npm install`
2. **API key errors** - Ensure `GOOGLE_AI_API_KEY` is set in `.env`
3. **Port conflicts** - Change PORT in `.env` if 8000 is in use
4. **CORS errors** - Check `FRONTEND_URL` in backend configuration
5. **Model not found errors** - Try alternative model names:
   - `gemini-2.5-flash` (recommended)
   - `gemini-2.5-pro`
   - Visit `http://localhost:8000/api/models` to see available models

### Debug Mode

Set `NODE_ENV=development` in `.env` for detailed error messages.

## 📄 License

This project is created for educational and demonstration purposes.

## 🤝 Contributing

This is a demonstration project. For production use, consider:

- Adding comprehensive tests
- Implementing proper error boundaries
- Adding logging and monitoring
- Setting up CI/CD pipeline
- Adding security audits

---

**Powered by Google Gemini AI** 🤖
