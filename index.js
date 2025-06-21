console.log('Starting QR Code Generator...');
const fastify = require('fastify')({ 
  logger: true,
  trustProxy: true,
  disableRequestLogging: true // Reduce noise in serverless logs
});
console.log('Fastify initialized');
const QRCode = require('qrcode');
console.log('QRCode library loaded');
const path = require('path');

// Register fastify-static for serving static files
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/'
});

// Register fastify-formbody for parsing form data
fastify.register(require('@fastify/formbody'));

// Route to serve a simple HTML form - FIXED
fastify.get('/', async (request, reply) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>QR Code Generator</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="font-sans max-w-2xl mx-auto mt-12 p-5 bg-gray-100">
        <div class="w-full bg-white p-8 rounded-lg shadow-md">
            <h1 class="text-gray-800 text-center mb-6 text-2xl font-bold">🔗 QR Code Generator</h1>
            <form action="/generate" method="post" class="flex flex-col">
                <input type="text" name="text" placeholder="Enter text or URL to generate QR code" required class="p-3 my-2 text-base rounded-md border border-gray-300 w-full box-border">
                <button type="submit" class="p-3 my-2 text-base rounded-md border-none cursor-pointer w-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">Generate QR Code</button>
            </form>

            <div class="api-info mt-8 p-5 bg-gray-50 rounded-md">
                <h2 class="text-gray-700 mt-0 text-xl font-semibold">📋 API Endpoints:</h2>
                <ul class="list-none p-0">
                    <li class="my-2 p-2 bg-white rounded-sm border-l-4 border-blue-600"><strong>GET /qr/:text</strong> - Generate QR code from URL parameter</li>
                    <li class="my-2 p-2 bg-white rounded-sm border-l-4 border-blue-600"><strong>POST /generate</strong> - Generate QR code from form data</li>
                    <li class="my-2 p-2 bg-white rounded-sm border-l-4 border-blue-600"><strong>GET /qr-json/:text</strong> - Get QR code as base64 JSON</li>
                    <li class="my-2 p-2 bg-white rounded-sm border-l-4 border-blue-600"><strong>POST /qr-advanced</strong> - Advanced QR code generation with custom options</li>
                </ul>

                <div class="example mt-4 p-3 bg-gray-200 rounded-sm">
                    <p class="font-semibold">Example: <a href="/qr/Hello%20World" target="_blank" class="text-blue-600 no-underline hover:underline">/qr/Hello World</a></p>
                    <p class="font-semibold">JSON API: <a href="/qr-json/Hello%20World" target="_blank" class="text-blue-600 no-underline hover:underline">/qr-json/Hello World</a></p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  // Set proper content type header
  reply.type('text/html');
  return reply.send(html);
});

// Generate QR code from URL parameter and return as image
fastify.get('/qr/:text', async (request, reply) => {
  try {
    const text = decodeURIComponent(request.params.text);
    
    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Set headers and send image
    reply.header('Content-Type', 'image/png');
    reply.header('Content-Disposition', `inline; filename="qr-${Date.now()}.png"`);
    reply.send(qrBuffer);
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    reply.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Generate QR code from form data
fastify.post('/generate', async (request, reply) => {
  try {
    const { text } = request.body;
    
    if (!text) {
      return reply.status(400).send('Text is required');
    }
    
    const qrBuffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: 400,
      margin: 2
    });
    
    // Convert to base64 for embedding in HTML
    const base64QR = qrBuffer.toString('base64');
    
    const resultHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Generated QR Code</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="font-sans max-w-lg mx-auto mt-12 p-5 text-center bg-gray-100">
          <div class="container bg-white p-8 rounded-lg shadow-md">
              <h1 class="text-gray-800 text-center mb-6 text-2xl font-bold">✅ Generated QR Code</h1>
              <div class="text-info bg-gray-50 p-4 rounded-md my-5 break-all">
                  <strong class="font-semibold">Text:</strong> ${text}
              </div>
              <div class="qr-container my-5 p-5 bg-gray-50 rounded-lg">
                  <img src="data:image/png;base64,${base64QR}" alt="QR Code" class="max-w-full h-auto border-2 border-gray-300 rounded-md mx-auto" />
              </div>
              <div class="flex justify-center space-x-4">
                  <a href="/" class="text-blue-600 no-underline my-0 mx-2 p-3 bg-gray-200 rounded-md inline-block transition-colors hover:bg-gray-300">← Generate Another QR Code</a>
                  <a href="data:image/png;base64,${base64QR}" download="qrcode.png" class="text-blue-600 no-underline my-0 mx-2 p-3 bg-gray-200 rounded-md inline-block transition-colors hover:bg-gray-300">📥 Download QR Code</a>
              </div>
          </div>
      </body>
      </html>
    `;

    reply.type('text/html');
    reply.send(resultHtml);

  } catch (error) {
    console.error('Error generating QR code:', error);
    reply.status(500).send('Failed to generate QR code');
  }
});

// API endpoint to get QR code as base64 JSON
fastify.get('/qr-json/:text', async (request, reply) => {
  try {
    const text = decodeURIComponent(request.params.text);
    
    // Generate QR code as data URL
    const qrDataURL = await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H'
    });
    
    return {
      text: text,
      qrCode: qrDataURL,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    reply.status(500).send({ 
      error: 'Failed to generate QR code',
      message: error.message 
    });
  }
});

// Advanced QR code generation with custom options
fastify.post('/qr-advanced', async (request, reply) => {
  try {
    const { 
      text, 
      size = 300, 
      margin = 2, 
      darkColor = '#000000', 
      lightColor = '#FFFFFF',
      format = 'png' 
    } = request.body;
    
    if (!text) {
      return reply.status(400).json({ error: 'Text is required' });
    }
    
    const options = {
      type: format,
      width: parseInt(size),
      margin: parseInt(margin),
      color: {
        dark: darkColor,
        light: lightColor
      }
    };
    
    if (format === 'svg') {
      const qrSVG = await QRCode.toString(text, { ...options, type: 'svg' });
      reply.header('Content-Type', 'image/svg+xml');
      reply.send(qrSVG);
    } else {
      const qrBuffer = await QRCode.toBuffer(text, options);
      reply.header('Content-Type', `image/${format}`);
      reply.send(qrBuffer);
    }
    
  } catch (error) {
    console.error('Error generating advanced QR code:', error);
    reply.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Error handling middleware
fastify.setErrorHandler((error, request, reply) => {
  console.error('Error:', error);
  reply.status(500).send({ error: 'Something went wrong!' });
});

// Initialize the server
const start = async () => {
  try {
    await fastify.ready();
    console.log('Fastify is ready');
  } catch (err) {
    console.error('Error initializing server:', err);
    process.exit(1);
  }
};

// For local development
if (require.main === module && process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 8080;
  fastify.listen({ port: port, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
    console.log(`QR Code Generator server running at http://localhost:${port}`);
  });
} else {
  // Initialize for serverless
  start();
}

// For Vercel serverless deployment
module.exports = async (req, res) => {
  try {
    await fastify.ready();
    fastify.server.emit('request', req, res);
  } catch (err) {
    console.error('Serverless function error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};
