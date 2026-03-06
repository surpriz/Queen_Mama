/**
 * WebSocket Transcription Proxy
 *
 * Relays audio from desktop/mobile clients to Deepgram without exposing
 * the API key to the client. The admin Deepgram key never leaves the server.
 *
 * Client connects with: ws://host:3001?token=<jwt>&language=fr&model=nova-3
 * Server authenticates the JWT, then opens a WebSocket to Deepgram using the
 * admin API key and relays data bidirectionally.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { verifyAccessToken } from "@/lib/device-auth";
import { getProviderApiKey } from "@/lib/ai-providers";
import { prisma } from "@/lib/prisma";

const MAX_BUFFER_CHUNKS = 50; // Max audio chunks to buffer while connecting to Deepgram

interface ClientState {
  userId: string;
  deepgramWs: WebSocket | null;
  audioBuffer: Buffer[];
  isDeepgramReady: boolean;
}

export function createTranscriptionProxy(port: number = 3001): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.log(`[TranscriptionProxy] Listening on port ${port}`);

  wss.on("connection", async (clientWs: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const token = url.searchParams.get("token");
    const language = url.searchParams.get("language") || "fr";
    const model = url.searchParams.get("model") || "nova-3";

    if (!token) {
      clientWs.close(4001, "Missing authentication token");
      return;
    }

    // Authenticate the client
    let userId: string;
    try {
      const payload = await verifyAccessToken(token);
      userId = payload.sub;
      console.log(`[TranscriptionProxy] Client authenticated: ${userId}`);
    } catch (error) {
      console.error("[TranscriptionProxy] Auth failed:", error);
      clientWs.close(4003, "Invalid or expired token");
      return;
    }

    // Get admin Deepgram API key
    const apiKey = await getProviderApiKey("deepgram");
    if (!apiKey) {
      clientWs.send(JSON.stringify({ type: "error", message: "Deepgram not configured" }));
      clientWs.close(4500, "Provider not configured");
      return;
    }

    const state: ClientState = {
      userId,
      deepgramWs: null,
      audioBuffer: [],
      isDeepgramReady: false,
    };

    // Connect to Deepgram
    const dgUrl =
      `wss://api.deepgram.com/v1/listen?` +
      `model=${model}&` +
      `language=${language}&` +
      `smart_format=true&` +
      `interim_results=true&` +
      `encoding=linear16&` +
      `sample_rate=16000&` +
      `channels=1`;

    const dgWs = new WebSocket(dgUrl, {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });
    state.deepgramWs = dgWs;

    dgWs.on("open", () => {
      console.log(`[TranscriptionProxy] Connected to Deepgram for user ${userId}`);
      state.isDeepgramReady = true;

      // Send notification to client
      clientWs.send(JSON.stringify({ type: "connected" }));

      // Flush buffered audio
      for (const chunk of state.audioBuffer) {
        dgWs.send(chunk);
      }
      state.audioBuffer = [];
    });

    dgWs.on("message", (data) => {
      // Relay Deepgram results to client
      const msg = data.toString();
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === "Results") {
          const transcript = parsed.channel?.alternatives?.[0]?.transcript || "";
          if (transcript.trim()) {
            console.log(`[TranscriptionProxy] [${userId}] ${parsed.is_final ? "FINAL" : "interim"}: "${transcript}"`);
          }
        } else if (parsed.type === "Metadata") {
          console.log(`[TranscriptionProxy] [${userId}] Deepgram metadata received (request_id: ${parsed.request_id})`);
        }
      } catch { /* not JSON, relay anyway */ }

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(msg);
      }
    });

    dgWs.on("error", (error) => {
      console.error(`[TranscriptionProxy] Deepgram error for ${userId}:`, error.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: "error", message: "Deepgram connection error" }));
      }
    });

    dgWs.on("close", (code, reason) => {
      console.log(`[TranscriptionProxy] Deepgram closed for ${userId}: code=${code} reason="${reason}"`);
      state.isDeepgramReady = false;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1000, "Deepgram disconnected");
      }
    });

    // Track audio chunk count for logging
    let audioChunkCount = 0;

    // Handle messages from client
    clientWs.on("message", (data, isBinary) => {
      if (isBinary) {
        audioChunkCount++;
        if (audioChunkCount === 1 || audioChunkCount % 100 === 0) {
          const size = Buffer.isBuffer(data) ? data.length : (data as ArrayBuffer).byteLength;
          console.log(`[TranscriptionProxy] [${userId}] Audio chunk #${audioChunkCount} (${size} bytes)`);
        }
        // Audio data — relay to Deepgram
        if (state.isDeepgramReady && dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(data);
        } else if (state.audioBuffer.length < MAX_BUFFER_CHUNKS) {
          // Buffer audio while Deepgram is connecting
          state.audioBuffer.push(Buffer.from(data as ArrayBuffer));
        }
      } else {
        // Text message (JSON control messages)
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "CloseStream") {
            if (dgWs.readyState === WebSocket.OPEN) {
              dgWs.send(JSON.stringify({ type: "CloseStream" }));
            }
          } else if (msg.type === "KeepAlive") {
            if (dgWs.readyState === WebSocket.OPEN) {
              dgWs.send(JSON.stringify({ type: "KeepAlive" }));
            }
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    clientWs.on("close", () => {
      console.log(`[TranscriptionProxy] Client disconnected: ${userId}`);
      state.audioBuffer = [];
      if (dgWs.readyState === WebSocket.OPEN || dgWs.readyState === WebSocket.CONNECTING) {
        dgWs.close(1000);
      }
    });

    clientWs.on("error", (error) => {
      console.error(`[TranscriptionProxy] Client error for ${userId}:`, error.message);
    });

    // Record usage
    prisma.usageLog
      .create({
        data: {
          userId,
          action: "transcription_proxy",
          provider: "deepgram",
        },
      })
      .catch(() => {});
  });

  return wss;
}
