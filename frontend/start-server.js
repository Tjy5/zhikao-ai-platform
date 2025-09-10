#!/usr/bin/env node

const net = require('net');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check if a port is in use using connect attempt
 */
function isPortInUse(port, host = 'localhost') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false); // Port is available (connection timeout)
    }, 1000);
    
    socket.setTimeout(1000);
    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true); // Port is in use
    });
    
    socket.on('timeout', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false); // Port is available
    });
    
    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false); // Port is available
    });
    
    socket.connect(port, host);
  });
}

/**
 * Find an available port starting from a given port number
 */
async function findFreePort(startPort = 3000, maxAttempts = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const inUse = await isPortInUse(port);
    
    if (!inUse) {
      console.log(`Found free port: ${port}`);
      return port;
    }
  }
  
  throw new Error(`No free port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

/**
 * Read backend port from file if it exists
 */
function getBackendPort() {
  try {
    const backendPortFile = path.join(__dirname, '..', 'backend_port.txt');
    if (fs.existsSync(backendPortFile)) {
      return fs.readFileSync(backendPortFile, 'utf8').trim();
    }
  } catch (error) {
    console.warn('Could not read backend port file:', error.message);
  }
  return '8001'; // Default fallback
}

/**
 * Update the frontend API endpoint dynamically
 */
function updateApiEndpoint(frontendPort, backendPort) {
  const apiConfigPath = path.join(__dirname, 'src', 'config', 'api.ts');
  const apiConfigDir = path.dirname(apiConfigPath);
  
  // Create config directory if it doesn't exist
  if (!fs.existsSync(apiConfigDir)) {
    fs.mkdirSync(apiConfigDir, { recursive: true });
  }
  
  const configContent = `// Auto-generated API configuration
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:${backendPort}'
  : 'http://localhost:${backendPort}';

export const FRONTEND_URL = 'http://localhost:${frontendPort}';
`;
  
  fs.writeFileSync(apiConfigPath, configContent);
  console.log(`API config updated: Backend=${backendPort}, Frontend=${frontendPort}`);
}

async function startFrontend() {
  try {
    // Get preferred port from environment, default to 3000
    const preferredPort = parseInt(process.env.FRONTEND_PORT || '3000');
    const frontendPort = await findFreePort(preferredPort);
    const backendPort = getBackendPort();

    console.log('=' + ''.repeat(60));
    console.log('Frontend Server Starting');
    console.log(`Port: ${frontendPort}`);
    console.log(`URL: http://localhost:${frontendPort}`);
    console.log(`Backend: http://localhost:${backendPort}`);
    console.log(`Turbopack: Enabled`);
    console.log('=' + ''.repeat(60));

    // Update API configuration
    updateApiEndpoint(frontendPort, backendPort);

    // Save frontend port to file
    const frontendPortFile = path.join(__dirname, '..', 'frontend_port.txt');
    fs.writeFileSync(frontendPortFile, frontendPort.toString());

    // Start Next.js development server
    const nextProcess = spawn('npx', ['next', 'dev', '--turbopack', '--port', frontendPort.toString()], {
      stdio: 'inherit',
      cwd: __dirname,
      shell: true
    });

    nextProcess.on('close', (code) => {
      console.log(`\nFrontend server stopped with code ${code}`);
    });

    process.on('SIGINT', () => {
      console.log('\nShutting down frontend server...');
      nextProcess.kill('SIGINT');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start frontend server:', error.message);
    process.exit(1);
  }
}

// Start the server
startFrontend();