//
//  VoiceActivityDetector.swift
//  QueenMama
//
//  Local voice-activity detection. Gates silence before audio reaches the
//  transcription WebSocket: fewer billed Deepgram seconds, cleaner transcripts,
//  and fewer false AI auto-triggers on noise/silence.
//
//  Implementations are interchangeable behind this protocol:
//    - `EnergyVAD`  — dependency-free RMS detector (default).
//    - `SileroVAD`  — ONNX model, drop-in upgrade (see stub).
//
//  Input/output are raw PCM16 mono @ 16kHz `Data` chunks (the same format the
//  rest of the audio pipeline already passes around).
//

import Foundation

@MainActor
protocol VoiceActivityDetector: AnyObject {
    /// Feed one PCM16 (16kHz mono) chunk. Returns the chunks that should be
    /// forwarded downstream: empty during silence, and on speech onset it
    /// includes the buffered pre-roll so word beginnings are never clipped.
    func process(_ chunk: Data) -> [Data]

    /// Clear all internal state. Call when a session stops.
    func reset()
}
