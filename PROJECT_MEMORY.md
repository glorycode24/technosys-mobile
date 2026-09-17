# 🧠 TechnoSys Mobile Project Memory & Architecture Context
> **Notice to Future Antigravity Agents**:  
> Read this document completely at the start of any new session or task. This file captures all mobile design decisions, user preferences, historical changes, bug fixes, and architectural standards established across all previous development conversations.

---

## 📱 1. Mobile App Overview & Stack
* **System Name**: TechnoSys Mobile (Field Technician App)
* **Client / Company**: TechnoCycle Corporation (Commercial HVAC & Engineering Services)
* **Repository Path**: `C:\Users\jhank\Projects\technosys-mobile`
* **Active Git Branch**: `glorycode24/combined-features`
* **Git Remotes**:
  * `origin`: `https://github.com/glorycode24/technosys-mobile.git`
  * `upstream`: `https://github.com/Azirielle/technosys-mobile.git`
* **Tech Stack**:
  * React Native (0.85), Expo SDK (v56), Expo Router, React Native Web
  * Expo Location & Geolib for GPS validation and duty-bound 60s periodic heartbeat
  * Expo Camera & ImagePicker for photo override DTR clock-ins
  * AsyncStorage for persistent offline preferences and notification states
  * Supabase Auth, PostgreSQL, and Realtime WebSockets

---

## 🌐 2. Language & Localization (i18n) Rules
* **Supported Languages**: English (`en`) and Filipino / Tagalog (`tl`).
* **IMPORTANT**: **Japanese (`ja`) was explicitly removed per user request.** Do NOT re-introduce Japanese options in the Preferences UI or language picker.
* **UI Component**: The Preferences modal features a clean 2-option Segmented Toggle (`🇺🇸 ENG` and `🇵🇭 FIL`).
* **Fallback Rule**: Localization uses `translate(key, lang)` from `src/lib/i18n.ts`. Any new feature strings defined in English will automatically fall back to English if Tagalog is not yet defined.
* **Persistence**: Language selection is saved to `AsyncStorage` under `@technocycle_language` and synced to Supabase `profiles.user_preferences`.

---

## 🔔 3. Notifications & Announcement Badges
* **Persistent Read Status**:
  * Read notification IDs are permanently stored in `AsyncStorage` under `READ_NOTIFS_${userId}` and `@read_notification_ids`.
  * The red unread notification dot indicator will **stay cleared** even after refreshing the page, closing the app, or logging out/in.
* **Priority Badges**:
  * Announcements feature distinct priority chips:
    * `🔴 URGENT ALERT` (Red badge `#FEE2E2` / text `#EF4444`)
    * `🔵 POLICY NOTICE` (Blue badge `#EFF6FF` / text `#2563EB`)
    * `🟢 GENERAL NOTICE` (Green badge `#ECFDF5` / text `#10B981`)
  * If edited by an admin, cards and detail sheets display an `✏️ EDITED` attribution badge.
* **Realtime Updates**:
  * Main `useEffect` subscribes to Supabase Realtime Channel on `public:announcements` table (`event: '*'`), automatically triggering `fetchAnnouncements()` and `fetchNotifications()` without requiring manual app reloads.

---

## 🛠️ 4. Field Operations & DTR
* **Clock In / Out**: Uses geofencing verification against scheduled sites. If outside the green zone, technicians can submit a Photo Override selfie which HR reviews.
* **Shift Completion Summary**: When shift ends, a completed shift card summarizes the time in/out and total hours.
* **Crew Visibility**: Technicians can see their Lead, Helpers, and Casuals on active dispatches with 1-tap phone dialing.
* **Disputes**: Technicians can log disputes for time logs or payslips, sending an alert directly to HR.
