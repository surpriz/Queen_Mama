import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { verifyAccessToken } from './device-auth';
import { getProviderApiKey } from './ai-providers';

const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';
const DEEPGRAM_KEEPALIVE_INTERVAL = 30000; // 30 seconds

interface ClientConnection {
  clientWs: WebSocket;
  deepgramWs: WebSocket | null;
  userId: string;
  deepgramKeepaliveInterval: NodeJS.Timeout | null;
  audioBuffer: Buffer[]; // Buffer audio while Deepgram connects
  deepgramReady: boolean;
}

const connections = new Map<WebSocket, ClientConnection>();

/**
 * Create and configure the WebSocket proxy server for transcription
 */
export function createTranscriptionProxyServer(port: number = 3001): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.log(`[TranscriptionProxy] WebSocket server listening on port ${port}`);

  wss.on('connection', async (clientWs: WebSocket, request: IncomingMessage) => {
    console.log('[TranscriptionProxy] New client connection');

    try {
      // Extract token from query string or headers
      const { query } = parse(request.url || '', true);
      const token = query.token as string || request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        console.error('[TranscriptionProxy] No token provided');
        clientWs.close(4001, 'Unauthorized: No token provided');
        return;
      }

      // Verify the access token
      let tokenPayload;
      try {
        tokenPayload = await verifyAccessToken(token);
        console.log('[TranscriptionProxy] Token verified for user:', tokenPayload.sub);
      } catch (error) {
        console.error('[TranscriptionProxy] Token verification failed:', error);
        clientWs.close(4001, 'Unauthorized: Invalid token');
        return;
      }

      // Get Deepgram API key from database
      const deepgramApiKey = await getProviderApiKey('deepgram');
      if (!deepgramApiKey) {
        console.error('[TranscriptionProxy] Deepgram API key not configured');
        clientWs.close(4002, 'Service unavailable: Deepgram not configured');
        return;
      }

      // Extract Deepgram parameters from query string
      const language = query.language as string || 'multi';
      const model = query.model as string || 'nova-2';

      // Build Deepgram WebSocket URL
      // endpointing=500 → finalize after 500ms of silence (catches micro-pauses in natural speech)
      // utterance_end_ms=1500 → emit UtteranceEnd after 1.5s silence
      const deepgramUrl = `${DEEPGRAM_WS_URL}?` +
        `model=${model}&` +
        `language=${language}&` +
        `smart_format=true&` +
        `interim_results=true&` +
        `punctuate=true&` +
        `endpointing=500&` +
        `utterance_end_ms=1500&` +
        `encoding=linear16&` +
        `sample_rate=16000&` +
        `channels=1`;

      console.log(`[TranscriptionProxy] Language: ${language}, Model: ${model}`);

      console.log('[TranscriptionProxy] Connecting to Deepgram...');

      // Connect to Deepgram using the admin API key
      const deepgramWs = new WebSocket(deepgramUrl, {
        headers: {
          Authorization: `Token ${deepgramApiKey}`,
        },
      });

      // Store the connection
      const connection: ClientConnection = {
        clientWs,
        deepgramWs,
        userId: tokenPayload.sub,
        deepgramKeepaliveInterval: null,
        audioBuffer: [],
        deepgramReady: false,
      };
      connections.set(clientWs, connection);

      // Handle Deepgram connection open
      deepgramWs.on('open', () => {
        console.log('[TranscriptionProxy] Connected to Deepgram');
        connection.deepgramReady = true;

        // Send any buffered audio
        if (connection.audioBuffer.length > 0) {
          console.log(`[TranscriptionProxy] Flushing ${connection.audioBuffer.length} buffered audio chunks`);
          for (const chunk of connection.audioBuffer) {
            deepgramWs.send(chunk);
          }
          connection.audioBuffer = [];
        }

        // Start keepalive to Deepgram (proxy handles this, not client)
        connection.deepgramKeepaliveInterval = setInterval(() => {
          if (deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, DEEPGRAM_KEEPALIVE_INTERVAL);

        clientWs.send(JSON.stringify({ type: 'connected', message: 'Transcription service ready' }));
      });

      // Relay transcription results from Deepgram to client
      deepgramWs.on('message', (data: Buffer) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });

      // Handle Deepgram errors
      deepgramWs.on('error', (error) => {
        console.error('[TranscriptionProxy] Deepgram WebSocket error:', error);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: 'Transcription service error' }));
        }
      });

      // Handle Deepgram close
      deepgramWs.on('close', (code, reason) => {
        console.log(`[TranscriptionProxy] Deepgram disconnected: ${code} - ${reason}`);

        // Clear the keepalive interval
        if (connection.deepgramKeepaliveInterval) {
          clearInterval(connection.deepgramKeepaliveInterval);
          connection.deepgramKeepaliveInterval = null;
        }
        connection.deepgramReady = false;

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1000, 'Deepgram connection closed');
        }
        connections.delete(clientWs);
      });

      // Relay audio from client to Deepgram
      // CRITICAL: Separate text (JSON control messages) from binary (audio data)
      clientWs.on('message', (data: RawData, isBinary: boolean) => {
        // Handle text messages (JSON control messages from client)
        if (!isBinary) {
          try {
            const message = JSON.parse(data.toString('utf8'));

            // Filter out KeepAlive messages - proxy handles its own keepalive to Deepgram
            if (message.type === 'KeepAlive') {
              // Don't relay to Deepgram - proxy manages keepalive separately
              return;
            }

            // Handle CloseStream request
            if (message.type === 'CloseStream') {
              console.log('[TranscriptionProxy] Client requested stream close');
              if (deepgramWs.readyState === WebSocket.OPEN) {
                deepgramWs.close(1000, 'Client requested close');
              }
              return;
            }

            // Log unknown control messages
            console.log('[TranscriptionProxy] Unknown control message:', message.type);
          } catch (parseError) {
            // Failed to parse as JSON - might be binary data sent as text
            console.warn('[TranscriptionProxy] Non-JSON text message received, ignoring');
          }
          return;
        }

        // Handle binary messages (audio data)
        const audioData = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

        if (connection.deepgramReady && deepgramWs.readyState === WebSocket.OPEN) {
          // Deepgram is ready - send directly
          deepgramWs.send(audioData);
        } else if (deepgramWs.readyState === WebSocket.CONNECTING) {
          // Deepgram is still connecting - buffer the audio
          connection.audioBuffer.push(audioData);
          if (connection.audioBuffer.length === 1) {
            console.log('[TranscriptionProxy] Buffering audio while Deepgram connects...');
          }
        } else {
          // Deepgram not available
          console.warn('[TranscriptionProxy] Dropping audio - Deepgram not connected');
        }
      });

      // Handle client close
      clientWs.on('close', () => {
        console.log('[TranscriptionProxy] Client disconnected');

        // Clear the keepalive interval
        if (connection.deepgramKeepaliveInterval) {
          clearInterval(connection.deepgramKeepaliveInterval);
          connection.deepgramKeepaliveInterval = null;
        }

        if (deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.close(1000, 'Client disconnected');
        }
        connections.delete(clientWs);
      });

      // Handle client errors
      clientWs.on('error', (error) => {
        console.error('[TranscriptionProxy] Client WebSocket error:', error);

        // Clear the keepalive interval
        if (connection.deepgramKeepaliveInterval) {
          clearInterval(connection.deepgramKeepaliveInterval);
          connection.deepgramKeepaliveInterval = null;
        }

        if (deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.close(1000, 'Client error');
        }
        connections.delete(clientWs);
      });

    } catch (error) {
      console.error('[TranscriptionProxy] Connection setup error:', error);
      clientWs.close(4000, 'Internal server error');
    }
  });

  wss.on('error', (error) => {
    console.error('[TranscriptionProxy] Server error:', error);
  });

  return wss;
}

/**
 * Gracefully shutdown the proxy server
 */
export function shutdownProxyServer(wss: WebSocketServer): Promise<void> {
  return new Promise((resolve) => {
    // Close all connections and cleanup intervals
    connections.forEach((connection) => {
      // Clear keepalive intervals
      if (connection.deepgramKeepaliveInterval) {
        clearInterval(connection.deepgramKeepaliveInterval);
      }

      connection.clientWs.close(1000, 'Server shutting down');
      connection.deepgramWs?.close(1000, 'Server shutting down');
    });
    connections.clear();

    wss.close(() => {
      console.log('[TranscriptionProxy] Server shut down');
      resolve();
    });
  });
}
