// Queen Mama LITE - Audio Capture Service
// Captures microphone audio using Web Audio API
// Converts to 16kHz PCM16 for Deepgram

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export interface AudioCaptureCallbacks {
  onAudioData: (data: ArrayBuffer) => void;
  onLevel: (rms: number) => void;
  onError: (error: Error) => void;
}

export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isCapturing = false;
  private callbacks: AudioCaptureCallbacks | null = null;

  async start(callbacks: AudioCaptureCallbacks): Promise<void> {
    if (this.isCapturing) {
      console.warn('[AudioCapture] Already capturing');
      return;
    }

    this.callbacks = callbacks;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Request high sample rate, we'll downsample
        },
      });

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 48000 });

      // Create source node from microphone
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create processor node for raw audio access
      // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
      this.processorNode = this.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

      this.processorNode.onaudioprocess = (event) => {
        if (!this.isCapturing || !this.callbacks) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Calculate RMS level
        const rms = this.calculateRMS(inputData);
        this.callbacks.onLevel(rms);

        // Downsample to 16kHz
        const downsampled = this.downsample(inputData, this.audioContext!.sampleRate, TARGET_SAMPLE_RATE);

        // Convert to PCM16
        const pcm16 = this.float32ToPCM16(downsampled);

        // Send to callback
        this.callbacks.onAudioData(pcm16.buffer);
      };

      // Connect nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isCapturing = true;
      console.log('[AudioCapture] Started capturing');
    } catch (error) {
      console.error('[AudioCapture] Failed to start:', error);
      this.cleanup();
      callbacks.onError(error instanceof Error ? error : new Error('Failed to start audio capture'));
    }
  }

  stop(): void {
    if (!this.isCapturing) return;

    this.isCapturing = false;
    this.cleanup();
    console.log('[AudioCapture] Stopped capturing');
  }

  private cleanup(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.callbacks = null;
  }

  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  private downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) {
      return buffer;
    }

    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, buffer.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      // Linear interpolation
      result[i] = buffer[srcIndexFloor] * (1 - fraction) + buffer[srcIndexCeil] * fraction;
    }

    return result;
  }

  private float32ToPCM16(buffer: Float32Array): Int16Array {
    const pcm16 = new Int16Array(buffer.length);

    for (let i = 0; i < buffer.length; i++) {
      // Clamp to [-1, 1]
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      // Convert to 16-bit signed integer
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    return pcm16;
  }

  get capturing(): boolean {
    return this.isCapturing;
  }
}

// Singleton instance
export const audioCaptureService = new AudioCaptureService();
export default audioCaptureService;
