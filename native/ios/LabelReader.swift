import Foundation
import CoreGraphics
import Vision
#if canImport(FoundationModels)
import FoundationModels
#endif

/* Reads a prescription label on the phone, with nothing uploaded:
   1. Apple Vision reads the text (far better than Tesseract on curved, glossy bottles).
   2. Apple's on-device language model (iOS 26+, with Apple Intelligence on) picks out
      the fields. The web code checks every value it returns against the text that was
      read, so it can fix layout problems but can't invent a medicine. */
enum LabelReader {

    // MARK: Text

    /// Words Vision should prefer when a letter is unclear.
    static let labelWords = [
        "TABLET", "TABLETS", "CAPSULE", "CAPSULES", "MOUTH", "DAILY", "TWICE", "REFILLS", "QTY",
        "MG", "MCG", "ML", "NDC", "RX", "DISCARD", "PHARMACY", "PRESCRIBER", "SUSPENSION", "SOLUTION",
    ]

    /// Reads the text in a photo as lines, top to bottom. Tries other rotations when
    /// the photo seems sideways, so a bottle held on its side still reads.
    static func recognizeText(in image: CGImage) throws -> [String] {
        var best: [String] = []
        var bestScore = -1.0
        for orientation in [CGImagePropertyOrientation.up, .right, .left, .down] {
            let (lines, score) = try recognize(image, orientation: orientation)
            if score > bestScore {
                best = lines
                bestScore = score
            }
            // plenty of confident text: this is the right way up
            if orientation == .up && score >= 40 { break }
        }
        return best
    }

    private static func recognize(_ image: CGImage, orientation: CGImagePropertyOrientation) throws -> ([String], Double) {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["en-US"]
        request.customWords = labelWords
        let zzStart = Date() // ZZDEBUG
        print("ZZDEBUG vision start \(image.width)x\(image.height) orientation \(orientation.rawValue)") // ZZDEBUG
        try VNImageRequestHandler(cgImage: image, orientation: orientation).perform([request])
        print("ZZDEBUG vision done in \(Date().timeIntervalSince(zzStart))s, \(request.results?.count ?? 0) pieces") // ZZDEBUG
        let observations = request.results ?? []
        // confident characters, so a sideways read full of guesses scores low
        let score = observations.reduce(0.0) { sum, o in
            guard let top = o.topCandidates(1).first else { return sum }
            return sum + Double(top.string.count) * Double(top.confidence)
        }
        return (layoutLines(observations, width: image.width, height: image.height), score)
    }

    /// Vision returns separate pieces for text side by side ("QTY: 30" and "REFILLS: 2").
    /// Put pieces that sit on the same row back into one line, left to right. Rows follow
    /// the slant of the text itself, so a tilted or sideways photo doesn't mix up columns.
    static func layoutLines(_ observations: [VNRecognizedTextObservation], width: Int, height: Int) -> [String] {
        let w = Double(width), h = Double(height)
        func px(_ p: CGPoint) -> (x: Double, y: Double) { (Double(p.x) * w, Double(p.y) * h) }
        let found = observations.compactMap { o -> (String, VNRecognizedTextObservation)? in
            guard let s = o.topCandidates(1).first?.string, !s.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
            return (s, o)
        }
        guard !found.isEmpty else { return [] }

        // the label's text direction: the median slant of the pieces
        let angles = found.map { _, o -> Double in
            let l = px(o.topLeft), r = px(o.topRight)
            return atan2(r.y - l.y, r.x - l.x)
        }.sorted()
        let angle = angles[angles.count / 2]
        let (c, s) = (cos(angle), sin(angle))

        // each piece in the text's own frame: u runs along the line, v runs up the label
        struct Piece { let text: String; let u: Double; let uMax: Double; let vMin: Double; let vMax: Double }
        let pieces = found.map { text, o -> Piece in
            let corners = [o.topLeft, o.topRight, o.bottomLeft, o.bottomRight].map(px)
            let u = corners.map { $0.x * c + $0.y * s }
            let v = corners.map { -$0.x * s + $0.y * c }
            return Piece(text: text, u: u.min()!, uMax: u.max()!, vMin: v.min()!, vMax: v.max()!)
        }

        var rows: [[Piece]] = []
        for p in pieces.sorted(by: { $0.vMin + $0.vMax > $1.vMin + $1.vMax }) {
            if let last = rows.last?.last {
                let overlap = min(last.vMax, p.vMax) - max(last.vMin, p.vMin)
                if overlap > 0.5 * min(last.vMax - last.vMin, p.vMax - p.vMin) {
                    rows[rows.count - 1].append(p)
                    continue
                }
            }
            rows.append([p])
        }
        // Vision sometimes returns a piece twice: alone, and inside a longer piece over the same spot
        func repeated(_ p: Piece, in row: [Piece]) -> Bool {
            row.contains { o in
                o.text.count > p.text.count && o.text.contains(p.text)
                    && min(o.uMax, p.uMax) - max(o.u, p.u) > 0.6 * (p.uMax - p.u)
            }
        }
        return rows.map { row in
            row.filter { !repeated($0, in: row) }.sorted { $0.u < $1.u }.map(\.text).joined(separator: "  ")
        }
    }

    // MARK: Fields

    /// Whether the on-device model can run, and if not, why (shown in the console only).
    static func modelStatus() -> (available: Bool, reason: String) {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            switch SystemLanguageModel.default.availability {
            case .available: return (true, "available")
            case .unavailable(let why): return (false, String(describing: why))
            }
        }
        #endif
        return (false, "needs iOS 26 or newer")
    }

    /// Field names the model answers with, mapped to the keys of LabelFields in src/lib/parseLabel.ts
    static let fieldKeys: [(answer: String, key: String, hint: String)] = [
        ("medicine", "drug", "name only, no strength or form"),
        ("strength", "strength", "number and unit, such as 10 MG"),
        ("form", "form", "such as TABLET or CAPSULE"),
        ("directions", "directions", "the pharmacy's directions for the patient, word for word, joining their lines; empty if there are none"),
        ("rxNumber", "rxNumber", ""),
        ("quantity", "quantity", ""),
        ("daysSupply", "daysSupply", "days supply, number only"),
        ("refills", "refills", ""),
        ("dateFilled", "filled", ""),
        ("prescriber", "prescriber", ""),
        ("pharmacy", "pharmacy", ""),
        ("pharmacyPhone", "pharmacyPhone", ""),
        ("pharmacyAddress", "pharmacyAddress", "the pharmacy's street address, city, state and ZIP"),
        ("ndc", "ndc", ""),
        ("manufacturer", "manufacturer", ""),
        ("pillDescription", "appearance", "the color, shape and imprint of the pill, only if the label describes them"),
    ]

    /// What the photos show, so the model knows how the text was put together.
    static func source(_ kind: String) -> String {
        kind == "box"
            ? "The text comes from photos of the sides of a medicine box: the pharmacy's label sticker and the maker's printing. " +
              "Take the directions, Rx number, refills, prescriber and pharmacy from the pharmacy sticker. Ignore lines like " +
              "'Each tablet contains', storage temperatures, 'See package insert', barcodes, lot and expiry numbers."
            : "The text comes from several photos taken around a curved bottle and was joined together, so a line may still be split or repeated."
    }

    static func extractFields(from text: String, kind: String = "bottle") async throws -> [String: String] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            // Reading a person's own label is a content transformation. The default guardrails
            // refuse most medical text as "sensitive", and the permissive ones only apply to
            // plain-text answers (not @Generable), so the answer is "key: value" lines.
            let model = SystemLanguageModel(guardrails: .permissiveContentTransformations)
            let template = fieldKeys.map { $0.hint.isEmpty ? "\($0.answer):" : "\($0.answer): (\($0.hint))" }.joined(separator: "\n")
            let session = LanguageModelSession(model: model, instructions: """
                You copy information from the text of a prescription bottle label into fields. \
                The text came from a camera, so lines may be out of order, split, or mixed with other text. \
                Copy values exactly as printed. Never guess or add anything; write nothing after the colon \
                when the label doesn't show it. The patient's own name is not the medicine, prescriber or pharmacy. \
                \(source(kind)) Answer with exactly these lines and nothing else:
                \(template)
                """)
            // the model's context is small; a label's text is far shorter than this
            let response = try await session.respond(to: "Label text:\n\(text.prefix(6000))", options: GenerationOptions(samplingMode: .greedy))
            return parseAnswer(response.content)
        }
        #endif
        throw LabelReaderError.modelUnavailable
    }

    static func parseAnswer(_ answer: String) -> [String: String] {
        var fields: [String: String] = [:]
        for line in answer.split(whereSeparator: \.isNewline) {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let name = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            guard let key = fieldKeys.first(where: { $0.answer.lowercased() == name })?.key else { continue }
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            // the model sometimes echoes the hint instead of leaving the field empty
            fields[key] = value.hasPrefix("(") && value.hasSuffix(")") ? "" : value
        }
        return fields
    }
}

enum LabelReaderError: Error { case modelUnavailable }
