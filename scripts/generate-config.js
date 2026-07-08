const fs = require('fs');
const path = require('path');

const socketServerUrl = process.env.SOCKET_SERVER_URL || '';
const content = `window.SOCKET_SERVER_URL = ${JSON.stringify(socketServerUrl)};\n`;
const outputPath = path.join(__dirname, '..', 'public', 'socket-config.js');

try {
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Generated socket-config.js with SOCKET_SERVER_URL=${socketServerUrl}`);
} catch (err) {
  console.error('Failed to generate socket-config.js:', err.message);
  process.exit(1);
}
