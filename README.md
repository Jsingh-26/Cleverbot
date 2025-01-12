# Cleverbot - AI Chat Assistant

A web-based AI chat assistant that uses multiple AI models through OpenRouter API to provide intelligent responses to any question.

## Features

- **Multiple AI Models**: Uses 26 different AI models in order of preference
- **Automatic Fallback**: If one model fails, automatically tries the next one
- **Simple Interface**: Clean and intuitive chat interface
- **Real-time Responses**: Stream responses as they are generated
- **Error Handling**: Graceful error handling with automatic model switching

## Models Used (in order of preference)

1. Google Gemini Models
   - Gemini Exp 1206
   - Gemini 2.0 Flash
   - Various other Gemini variants

2. Meta Llama Models
   - Llama 3.2 13B Vision
   - Multiple Llama variants

3. Other Models
   - Qwen 4.7B
   - Mistral 7B
   - Microsoft Phi-3
   - OpenChat 7B
   - And more...

## Setup

1. Clone the repository
2. Add your OpenRouter API key in the `script.js` file
3. Open `index.html` in a browser or deploy to a web server

## Usage

1. Open the application in your web browser
2. Type your question in the input field
3. Press Enter or click Send
4. The app will automatically use the best available model to answer your question

## Technologies Used

- HTML5
- CSS3
- JavaScript
- OpenRouter API for AI models

## Error Handling

The application implements a robust error handling system:
- If a model fails (rate limit, quota exceeded, etc.), it automatically tries the next model
- Only shows an error if all models have failed
- Provides clear feedback during the process

## License

MIT License 