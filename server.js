const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files from public directory (legacy)
app.use(express.static('public'));

// Serve static files from AR, VR, and FP directories
app.use('/AR', express.static(path.join(__dirname, 'AR')));
app.use('/VR', express.static(path.join(__dirname, 'VR')));
app.use('/FP', express.static(path.join(__dirname, 'FP')));

// Security headers for WebXR
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Main route - redirect to FP (PC/mobile version)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'FP', 'index.html'));
});

// AR version route
app.get('/AR', (req, res) => {
  res.sendFile(path.join(__dirname, 'AR', 'index.html'));
});

// VR version route
app.get('/VR', (req, res) => {
  res.sendFile(path.join(__dirname, 'VR', 'index.html'));
});

// FP version route (PC/mobile)
app.get('/FP', (req, res) => {
  res.sendFile(path.join(__dirname, 'FP', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Web Atom App running on http://localhost:${PORT}`);
  console.log(`📱 AR Version: http://localhost:${PORT}/AR`);
  console.log(`🥽 VR Version: http://localhost:${PORT}/VR`);
  console.log(`💻 FP Version: http://localhost:${PORT}/FP`);
  console.log(`📱 For mobile testing, use your local IP address`);
  console.log(`🔒 Make sure to serve over HTTPS in production for WebXR`);
});