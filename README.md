# ReadRx — prescription label reader and pill check

ReadRx is for older adults, people with low vision, and people who don't read English well. It has three jobs:
1. **Read the label.** Take 3 or more photos as you turn a prescription bottle (the label wraps around it), or photos of the sticker and front of a box (like ondansetron dissolving tablets). ReadRx reads them and puts the text together.
2. **Explain it.** It rewrites the directions and warning stickers in plain language, in English, Spanish, Portuguese, Chinese, Vietnamese or French, and reads them aloud.
3. **Check a pill.** Before you take a pill, photograph it and ReadRx checks its color, shape and stamped imprint against what that medicine should look like.

Everything happens on the phone: label reading, color analysis and storage. Photos and medicines are never uploaded. The only network request is the FDA lookup of what a pill should look like (plus the web font, which falls back to the system font offline).

## Install and run (Mac)

Requires Node.js 18+ from nodejs.org.

```bash
cd ~/Downloads/readrx
npm install
npm run dev
```

Open the `Local:` link on your computer.

### On your iPhone
1. Connect the Mac and the iPhone to the **same Wi-Fi**.
2. `npm run dev` also prints a `Network:` link, like `http://192.168.1.23:5173`. Type it into **Safari** on the iPhone.
3. Tap **Share**, then **Add to Home Screen**. ReadRx then opens full-screen like an app, with its own icon.

The first time it reads a label, it downloads the text-reading engine (about 10 MB), so use Wi-Fi.

For a link that works anywhere, run `npm run build` and drag the `dist` folder onto a free static host such as Netlify Drop. On the free tier you get an https link you can share with judges.

## Install as a real iPhone app (Xcode)

You need:
- a Mac with **Xcode** (free in the Mac App Store, about 12 GB; open it once after installing);
- **Node.js 20+**;
- your iPhone and a USB cable;
- a free Apple ID.

1. In Terminal:
   ```bash
   cd ~/Downloads/readrx
   npm install
   npm run ios
   ```
   This builds the app, creates the Xcode project, adds the camera and photo permission messages, and opens Xcode.
2. In Xcode, click **App** in the left sidebar, then the **Signing & Capabilities** tab. Under **Team**, choose **Add an Account…**, sign in with your Apple ID, then pick **(Your Name) (Personal Team)**.
   - If Xcode says the bundle identifier is unavailable, change `com.arjunsenani.readrx` to something unique, like `com.arjunsenani.readrx2`.
3. Plug in the iPhone and tap **Trust** on the phone. Choose the iPhone from the device menu at the top of Xcode, then press the ▶ **Run** button.
4. On the iPhone, the first time only:
   - **Settings → Privacy & Security → Developer Mode → On**. The phone restarts.
   - **Settings → General → VPN & Device Management →** tap your Apple ID → **Trust**.
   - Then press ▶ in Xcode again.

With a free Apple ID, the app works for **7 days**, then stops opening. Plug in and press ▶ again to renew it. A paid Apple Developer account ($99/year) gives one-year installs and TestFlight.

After changing the code, run `npm run ios:update`, then press ▶ in Xcode. After changing the Swift files in `native/ios`, run `npm run ios` instead (it copies them into the Xcode project).

## How it works

| Step | How | File |
|---|---|---|
| Read the label | In the iPhone app: Apple Vision text recognition, with rows rebuilt along the slant of the text so tilted or sideways photos keep their columns. In the browser: Tesseract OCR after grayscale and contrast cleanup | `native/ios/LabelReader.swift`, `src/lib/ocr.ts` |
| Put the photos together | Bottle: lines that overlap between photos are joined, keeping the copy of each word that wasn't cut by the photo's edge. Box: the sides are separate, so only repeated lines are removed | `src/lib/stitch.ts` |
| Find the fields (iPhone, Apple Intelligence on) | Apple's on-device language model reads the fields. Each value is kept only if every word is in the text the camera read (one-letter OCR slips allowed, numbers exact) and it's the right kind of value (directions start with TAKE, DISSOLVE…; a pill description names a color or shape); otherwise the rules below fill it in | `native/ios/LabelReader.swift`, `src/lib/extract.ts` |
| Find the fields (otherwise) | Rules for the medicine, strength, directions, Rx number, refills, phone, NDC and pill description, including common OCR slips (`M0UTH` → `MOUTH`) | `src/lib/parseLabel.ts` |
| Understand the directions | Pharmacy shorthand (`TAKE 1 TAB PO BID`) parsed into a structure | `src/lib/sig.ts` |
| Translate | Fixed, checked sentence templates per language, **not machine translation**. If any word isn't understood, ReadRx shows and reads the label exactly as printed and says so. | `src/lib/sig.ts`, `src/lib/warnings.ts` |
| Read aloud | The phone's built-in voices (Web Speech API), one line at a time with the current line highlighted, plus a slower speed | `src/lib/speech.ts` |
| Expected pill look | The pharmacy's printed description, or the FDA drug label via openFDA, using the "How supplied" text for that exact strength | `src/lib/appearance.ts`, `src/lib/fda.ts` |
| Days supply and refills | The days supply printed on the label, or quantity ÷ units per day from the directions (e.g. 6 capsules, 1 every 14 days = 84 days). "As needed" and inhalers can't be counted, so the person enters it. A days-left counter, and "I picked up a refill" restarts it and uses one refill | `src/lib/refill.ts`, `src/components/SupplyCard.tsx` |
| Refill reminders | Local notifications scheduled on the phone (no server): 9 am a week before running out (sooner for short supplies) and the day before. With no refills left, they say to call the pharmacy, which asks the prescriber | `src/lib/reminders.ts` |
| Pharmacy | Name, address (opens Apple Maps for directions) and a call button, read from the label | `src/lib/parseLabel.ts`, `src/screens/MedicineView.tsx` |
| Check the photo | Separate the pill from a plain background, take its typical color and measure its proportions. No machine learning. | `src/lib/pillImage.ts` |
| Decide | "Matches" only when color, shape **and** the stamp you confirm all agree. Any mismatch says "Don't take this pill yet" and offers to call the pharmacy. | `src/screens/PillCheck.tsx` |
| Ask about a symptom | Say or type a symptom. A curated offline list of FDA OTC monograph ingredients only (no prescription entries) is matched on the phone: no model, no network. Emergency signs skip suggestions and show 911 / 988 / Poison Control. Suggestions are checked against your allergies and saved medicines (same ingredient twice, NSAIDs with blood thinners, decongestants with blood-pressure medicines, sleepy antihistamines at 65+). No doses: always the package label. Consent is required before first use, and disclaimers appear on every answer and are spoken aloud | `src/lib/otc/`, `src/screens/Assistant.tsx`, `native/ios/ListenPlugin.swift` (on-device `SFSpeechRecognizer`) |
| Profile and theme | Name, main pharmacy, birth date, doctor, allergies, language, text size and theme color, saved on the phone only. The theme color drives the background and buttons; accent text is darkened per color to 7:1 | `src/lib/store.ts`, `src/lib/theme.ts`, `src/screens/Setup.tsx`, `src/screens/ProfileScreen.tsx` |

**Why the stamp matters most:** many pills are small, white and round. The imprint code is how pharmacists tell look-alikes apart, and phone cameras can't read it reliably. So ReadRx asks you to confirm it instead of guessing.

## Tests

```bash
npm test
```

There are 48 tests. They cover:
- days supply, the days-left count, refills and reminder timing;
- reading the pharmacy address;
- stitching photos taken around a bottle, including text Apple Vision read from a label on a curved surface;
- keeping only the on-device model's fields that the label text backs up;
- the shorthand parser and every language's output;
- reading noisy labels;
- warning detection;
- pill descriptions from FDA-style text;
- pill color and shape from synthetic photos.

## Before real-world use

- **Translations:** have the templates checked by native-speaking pharmacists.
- **Testing:** test with real bottles from several pharmacies. OCR on curved, glossy labels is the weakest step.
- **Safety:** ReadRx is a reading aid, not a pharmacist. Keep that message visible.
