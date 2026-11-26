# Eerah: store release kit

Everything needed to put Eerah on the App Store and Google Play. Screenshots and graphics are in this folder.

## Your accounts and setup, in order

### Apple App Store ($99/year)

1. **Enroll.** Go to developer.apple.com/programs and tap Enroll. Choose **Individual**. Your Apple ID needs two-factor sign-in. Apple may ask you to verify your ID in the Apple Developer app on your iPhone. Approval usually takes 1–2 days.
2. **Register the app ID.** In developer.apple.com → Account → Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App:
   - Description: `Eerah`
   - Bundle ID (Explicit): `io.github.mopip6667ui.eera`
   - Capabilities: leave all off. Tap Continue, then Register.
3. **Create the app listing.** In appstoreconnect.apple.com → Apps → **+** → New App:
   - Platform: iOS · Name: `Eerah – Ideas from Books` · Language: English (U.S.)
   - Bundle ID: the one above · SKU: `eera-001` · Access: Full
4. **Create an upload key.** In App Store Connect → Users and Access → **Integrations** → App Store Connect API → Team Keys → **+**:
   - Name: `GitHub builds` · Access: **Admin** (needed so the cloud build can create signing certificates)
   - Download the `.p8` file. **You can only download it once.** Note the **Key ID**, and the **Issuer ID** shown above the list.
   - Your **Team ID** is on developer.apple.com → Account → Membership details.
5. **Add 4 secrets in GitHub.** Repo → Settings → Secrets and variables → Actions → New repository secret:
   - `APP_STORE_CONNECT_KEY_ID`: the Key ID
   - `APP_STORE_CONNECT_ISSUER_ID`: the Issuer ID
   - `APP_STORE_CONNECT_KEY_P8`: open the .p8 file in a text editor and paste **all** of its text, including the BEGIN/END lines
   - `APPLE_TEAM_ID`: your Team ID
6. **Build and upload.** Repo → **Actions** → iOS build → Run workflow → leave "Upload to TestFlight" ticked → Run. It takes about 15–20 minutes. The build then appears in App Store Connect → TestFlight about 10–30 minutes later.
7. **Test on your iPhone.** Install the **TestFlight** app. In App Store Connect → TestFlight, add yourself under Internal Testing, then open the invite on your phone.
8. **Fill in the listing and submit.** Use the text below and upload the `iphone-6.9-*.png` screenshots. Set App Privacy to **Data Not Collected**. Pick the build and tap **Add for Review**, then **Submit**. Review usually takes 1–3 days.

### Google Play ($25 one-time)

1. **Sign up** at play.google.com/console as a **Personal** account. Google verifies your ID, and you need an Android phone for the account checks.
2. **Add the 4 Android signing secrets** in GitHub, from the private file Claude gave you (`underline-android-secrets.txt`). Then run **Actions → Android build → Run workflow**. When it finishes, open the run and download **eera-play-store-bundle** (the `.aab` file).
3. **Create the app.** Play Console → Create app: name `Eerah – Ideas from Books`, App, Free. Accept the declarations.
4. **Set up the app** (Dashboard → "Set up your app"):
   - Privacy policy: `https://mopip6667-ui.github.io/underline/privacy.html`
   - App access: all functionality available without login
   - Ads: no ads
   - Content rating: fill in the questionnaire (Reference/Education, no violence, no user content). Expect "Everyone" or "Teen".
   - Target audience: 13+ (choosing an age range that includes children triggers extra Families requirements)
   - Data safety: no data collected, no data shared
   - Store listing: the text below, `play-icon-512.png`, `play-feature-graphic-1024x500.png`, and the `android-*.png` screenshots
5. **Test.** Testing → Closed testing → Create track → upload the `.aab`. Add at least **12 testers** (friends' Gmail addresses) and keep the test running for **14 days**. New personal accounts must do this before going public.
6. **Go to production.** After 14 days, Dashboard → Apply for production. Once approved, create a production release with the same `.aab`.

The test APK (`eera-android-test-apk` in each Android build run) installs directly on an Android phone for quick checks.

## Store listing text

**App name** (30 max): Eerah – Ideas from Books
**Subtitle, Apple** (30 max): She reads so you don't have to
**Short description, Google** (80 max): She reads so you don't have to. Swipe the best ideas from great books.

**Promotional text, Apple** (170 max):
New books every week across finance, science, history and philosophy. Save the ideas that hit, and read the classics in full.

**Description:**
Eerah turns great books into ideas you can actually use. Each card is one key idea or short line from a book, what it means, and one thing to try this week. Swipe up for the next.

Browse a library organised like a bookstore for curious minds:
• Finance & Investing, sector by sector: tech, industrials, aviation, materials and energy, real estate, banks, consumer, healthcare, macro
• Science & Discovery, from Archimedes and Galileo to the scholars of the Islamic Golden Age
• History & Warriors: Julius Caesar, Khalid ibn al-Walid, Salahuddin, great commanders and warrior codes
• Philosophy & Wisdom, Psychology & Decisions, Business & Strategy, Habits & Performance

Read the classics in full. 19 complete public-domain books, including Meditations, The Art of War, Walden, The Prince, the Tao Te Ching, Plato's Republic and Darwin's Origin of Species. Chapters, adjustable text, a light or dark page, and your place saved.

For newer books, every book page shows where to borrow it free with a library card.

• New books added every week
• Save cards with a double-tap
• Daily card notification at the time you choose
• Works offline
• No account, no ads, no tracking

Ideas are summarised in our own words. Quotes are short and attributed.

**Keywords, Apple** (100 max): book summaries,ideas,quotes,stoicism,investing,philosophy,history,reading,classics,self improvement
**Category:** Books (primary), Education (secondary). Google: Books & Reference.
**Age rating, Apple:** 4+ (answer "None" to every content question)
**Price:** Free
**Support URL:** https://mopip6667-ui.github.io/underline/support.html
**Privacy policy URL:** https://mopip6667-ui.github.io/underline/privacy.html
**Marketing URL:** https://mopip6667-ui.github.io/underline/
**Copyright:** 2026 Eerah

**App Review notes, Apple:**
No login is required. The app bundles a library of original book-summary cards plus complete public-domain books (Standard Ebooks editions) for offline reading. Native features: daily card local notification (⋯ menu → Daily card), the native share sheet for cards, haptic feedback on save, and on-device storage for saved cards and reading progress. New cards are downloaded weekly from our public library files on GitHub Pages; no personal data is sent.

## App privacy answers

- **Apple App Privacy:** Data Not Collected.
- **Google Data safety:** no data collected or shared. Data is not encrypted in transit because none is sent; book files are fetched over HTTPS. There is no account, so no deletion mechanism is needed.

## Releasing updates

- **New books** arrive inside the app automatically every week. No store update needed.
- **App changes:** bump `versionName` (Android, `android/app/build.gradle`) and `MARKETING_VERSION` (iOS, in Xcode project settings), then run both build workflows and submit the new builds.
