import Foundation
import Capacitor
import AVFoundation

/// Reads text aloud with the iPhone's own voices (AVSpeechSynthesizer), exposed to the
/// web code as `Speech` (see src/lib/speech.ts). Unlike the web view's speech, this plays
/// even when the ringer switch is on silent, and works for any language voice installed.
@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "SpeechPlugin"
    public let jsName = "Speech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "voices", returnType: CAPPluginReturnPromise),
    ]

    private let synth = AVSpeechSynthesizer()
    private var pending: [ObjectIdentifier: CAPPluginCall] = [:]
    private var release: DispatchWorkItem?

    override public func load() {
        synth.delegate = self
    }

    /// { text, lang: "es-US", rate: 0.9 } -> { finished } once that text has been spoken (false if stopped)
    @objc func speak(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        let lang = call.getString("lang") ?? "en-US"
        let rate = Float(call.getDouble("rate") ?? 0.9)
        DispatchQueue.main.async {
            self.release?.cancel()
            self.activateAudio()
            let u = AVSpeechUtterance(string: text)
            u.voice = Self.bestVoice(for: lang)
            u.rate = min(AVSpeechUtteranceMaximumSpeechRate, max(AVSpeechUtteranceMinimumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * rate))
            u.postUtteranceDelay = 0.25
            self.pending[ObjectIdentifier(u)] = call
            self.synth.speak(u)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.synth.stopSpeaking(at: .immediate)
            for (_, c) in self.pending { c.resolve(["finished": false]) }
            self.pending.removeAll()
            self.scheduleRelease()
            call.resolve()
        }
    }

    /// -> { languages: ["en-US", "es-MX", …] } for the voices installed on this phone
    @objc func voices(_ call: CAPPluginCall) {
        let langs = Set(AVSpeechSynthesisVoice.speechVoices().map { $0.language })
        call.resolve(["languages": Array(langs).sorted()])
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        done(utterance, finished: true)
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        done(utterance, finished: false)
    }

    private func done(_ u: AVSpeechUtterance, finished: Bool) {
        DispatchQueue.main.async {
            self.pending.removeValue(forKey: ObjectIdentifier(u))?.resolve(["finished": finished])
            if self.pending.isEmpty { self.scheduleRelease() }
        }
    }

    /// Exact language first ("es-US"), then any voice for that language ("es-MX"); best quality wins.
    private static func bestVoice(for tag: String) -> AVSpeechSynthesisVoice? {
        let all = AVSpeechSynthesisVoice.speechVoices()
        let base = String(tag.prefix(while: { $0 != "-" })).lowercased()
        let exact = all.filter { $0.language.caseInsensitiveCompare(tag) == .orderedSame }
        let near = all.filter { $0.language.lowercased().hasPrefix(base) }
        let pick = (exact.isEmpty ? near : exact).max { $0.quality.rawValue < $1.quality.rawValue }
        return pick ?? AVSpeechSynthesisVoice(language: tag)
    }

    /// Play as spoken audio: ignores the silent switch and lowers music while talking.
    private func activateAudio() {
        let s = AVAudioSession.sharedInstance()
        // playback, so it comes out of the loudspeaker even right after the microphone was on
        try? s.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? s.setActive(true)
    }

    /// Give other apps' audio back shortly after we stop talking.
    private func scheduleRelease() {
        release?.cancel()
        let item = DispatchWorkItem { [weak self] in
            // not while the microphone has the session (ListenPlugin), or it would cut it off
            guard let self, !self.synth.isSpeaking, self.pending.isEmpty, !ListenPlugin.active else { return }
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
        release = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: item)
    }
}
