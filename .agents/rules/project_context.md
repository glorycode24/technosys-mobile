# TechnoSys Mobile Workspace Rules & Context
> This rule is automatically loaded by Antigravity for every conversation in this workspace.

## Key Directives:
1. **Branch**: Always work on branch `glorycode24/combined-features`.
2. **Context**: Refer to `PROJECT_MEMORY.md` in the project root for full design history, preferences, and architecture.
3. **Language**: Strictly support English (`en`) and Filipino / Tagalog (`tl`). Japanese is permanently removed. Use the 2-option ENG/FIL toggle in Preferences.
4. **Notifications**: Never hardcode notifications `read: false` on fetch. Always cross-reference saved read IDs from `AsyncStorage`.
5. **Announcements**: Preserve priority badges (`🔴 URGENT ALERT`, `🔵 POLICY NOTICE`, `🟢 GENERAL NOTICE`) and `✏️ EDITED` labels.
6. **Realtime**: Keep the Supabase Realtime channel listener active on the `announcements` table so field technicians receive broadcasts without logging out.
