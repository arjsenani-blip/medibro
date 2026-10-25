import Foundation
import Capacitor
import UIKit

/// Exposes LabelReader to the web code as `LabelReader` (see src/lib/nativeReader.ts).
@objc(LabelReaderPlugin)
public class LabelReaderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LabelReaderPlugin"
    public let jsName = "LabelReader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "modelStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "extractFields", returnType: CAPPluginReturnPromise),
    ]

    /// { image: base64 JPEG } -> { text }
    @objc func recognizeText(_ call: CAPPluginCall) {
        let base64 = (call.getString("image") ?? "").replacingOccurrences(of: #"^data:[^,]*,"#, with: "", options: .regularExpression)
        guard let data = Data(base64Encoded: base64), let image = UIImage(data: data)?.cgImage else {
            call.reject("Couldn't open the photo")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                call.resolve(["text": try LabelReader.recognizeText(in: image).joined(separator: "\n")])
            } catch {
                call.reject("Couldn't read the text", nil, error)
            }
        }
    }

    /// -> { available, reason }
    @objc func modelStatus(_ call: CAPPluginCall) {
        let status = LabelReader.modelStatus()
        call.resolve(["available": status.available, "reason": status.reason])
    }

    /// { text, kind: "bottle" | "box" } -> { fields: { drug, strength, … } }
    @objc func extractFields(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        let kind = call.getString("kind") ?? "bottle"
        Task {
            do {
                call.resolve(["fields": try await LabelReader.extractFields(from: text, kind: kind)])
            } catch {
                call.reject("The on-device model couldn't read the fields", nil, error)
            }
        }
    }
}
