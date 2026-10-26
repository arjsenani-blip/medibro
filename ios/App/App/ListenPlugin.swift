import Foundation
import Capacitor
import Speech
import AVFoundation

/// Hears a spoken question with Apple's speech recognizer, on the phone only
/// (requiresOnDeviceRecognition: nothing is sent to Apple's servers). Exposed to
/// the web code as `Listen` (see src/lib/listen.ts). While listening it also sends the
/// microphone level, 0–1, as "level" events about 25 times a second for the waveform.
@objc(ListenPlugin)
public class ListenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ListenPlugin"
    public let jsName = "Listen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var finish: CAPPluginCall?
    private var latest = ""
    private var lastLevel = Date.distantPast

    private func recognizer(_ lang: String) -> SFSpeechRecognizer? {
        SFSpeechRecognizer(locale: Locale(identifier: lang)) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    }

    /// { lang } -> { available, reason } — on-device recognition needs a downloaded language model
    @objc func available(_ call: CAPPluginCall) {
        let r = recognizer(call.getString("lang") ?? "en-US")
        let ok = r?.supportsOnDeviceRecognition ?? false
        call.resolve(["available": ok, "reason": ok ? "" : "on-device recognition not supported for this language"])
    }

    /// { lang } -> resolves with { text } when listening ends (stop(), silence, or an error).
    /// Partial words arrive as "partial" events: { text }.
    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "en-US"
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { return call.reject("Speech recognition isn’t allowed. Settings → ReadRx → Speech Recognition.", "denied") }
            let next: (Bool) -> Void = { granted in
                guard granted else { return call.reject("The microphone isn’t allowed. Settings → ReadRx → Microphone.", "denied") }
                DispatchQueue.main.async { self.begin(call, lang: lang) }
            }
            if #available(iOS 17.0, *) { AVAudioApplication.requestRecordPermission(completionHandler: next) }
            else { AVAudioSession.sharedInstance().requestRecordPermission(next) }
        }
    }

    private func begin(_ call: CAPPluginCall, lang: String) {
        stopAudio()
        guard let r = recognizer(lang), r.isAvailable, r.supportsOnDeviceRecognition else {
            return call.reject("Speech recognition on this phone isn’t available for this language. Type your question instead.", "unavailable")
        }
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.requiresOnDeviceRecognition = true // never leaves the phone
        request = req
        latest = ""
        finish = call

        do {
            let s = AVAudioSession.sharedInstance()
            try s.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try s.setActive(true, options: .notifyOthersOnDeactivation)
            let input = engine.inputNode
            input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { [weak self] buffer, _ in
                req.append(buffer)
                self?.sendLevel(buffer)
            }
            engine.prepare()
            try engine.start()
        } catch {
            finish = nil
            stopAudio()
            return call.reject("Couldn’t start the microphone.", "audio")
        }

        task = r.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            if let result {
                self.latest = result.bestTranscription.formattedString
                self.notifyListeners("partial", data: ["text": self.latest])
            }
            if error != nil || (result?.isFinal ?? false) { DispatchQueue.main.async { self.end() } }
        }
    }

    /// RMS of this buffer in dB, -50…0 dB mapped to 0–1 (same scale as src/lib/level.ts).
    private func sendLevel(_ buffer: AVAudioPCMBuffer) {
        let now = Date()
        guard now.timeIntervalSince(lastLevel) >= 0.04, let data = buffer.floatChannelData?[0] else { return }
        lastLevel = now
        let n = Int(buffer.frameLength)
        guard n > 0 else { return }
        var sum: Float = 0
        for i in 0..<n { sum += data[i] * data[i] }
        let rms = sqrt(sum / Float(n))
        let db = rms > 0 ? 20 * log10(rms) : -160
        let level = max(0, min(1, (db + 50) / 50))
        notifyListeners("level", data: ["value": level])
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.request?.endAudio() // lets the recognizer deliver its final result
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { self.end() }
            call.resolve()
        }
    }

    private func end() {
        guard let call = finish else { return }
        finish = nil
        stopAudio()
        call.resolve(["text": latest])
    }

    private func stopAudio() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
