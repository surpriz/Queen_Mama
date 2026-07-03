//
//  SileroVAD.swift
//  QueenMama
//
//  Phase 2 placeholder. Implements the same `VoiceActivityDetector` protocol as
//  `EnergyVAD`, so it can be swapped in without touching the call sites in
//  AppState. Wiring it up requires adding onnxruntime + the `silero_vad.onnx`
//  model (the project currently has no ONNX dependency — keep it that way until
//  the native `EnergyVAD` proves insufficient in real meetings).
//
//  Reference (from Cluely's bundle): frameSamples, positiveSpeechThreshold,
//  negativeSpeechThreshold, redemptionFrames, preSpeechPadFrames, minSpeechFrames.
//
//  Until implemented this delegates to `EnergyVAD` so the protocol stays usable.
//

import Foundation

@MainActor
final class SileroVAD: VoiceActivityDetector {
    private let fallback = EnergyVAD()

    // TODO(phase 2): load silero_vad.onnx via onnxruntime, run inference per
    // frameSamples window, apply threshold/redemption/preSpeechPad logic.

    func process(_ chunk: Data) -> [Data] {
        fallback.process(chunk)
    }

    func reset() {
        fallback.reset()
    }
}
