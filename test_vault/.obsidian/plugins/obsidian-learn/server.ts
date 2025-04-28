// server.ts
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Proxy requests to LM Studio
app.use('/v1', createProxyMiddleware({
  target: 'http://127.0.0.1:1234',
  changeOrigin: true,
  // Ensure the path is forwarded correctly
  pathRewrite: { '^/v1': '/v1' }
}));

// For debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});