# CareSense Mobile — Flutter

Integrated caregiver mobile app for CareSense platform.  
Modules: **SENTRY** (fall risk) + **ADL** (activities of daily living)

## Team

| Who | Module | Folder |
|-----|--------|--------|
| Harishalinee | SENTRY 🛡 | `lib/features/sentry/` |
| Teammate | ADL 🏃 | `lib/features/adl/` |

## Setup

```bash
# 1. Clone the repo and switch to this branch
git checkout caresense-mobile-flutter

# 2. Install dependencies
flutter pub get

# 3. Run the app
flutter run
```

## Project Structure

```
lib/
├── main.dart                     # App entry point
├── core/
│   ├── constants/colors.dart     # All colours
│   ├── config/api_config.dart    # Backend URL (update when backend ready)
│   └── services/
│       ├── sentry_service.dart   # SENTRY API (Harishalinee)
│       └── adl_service.dart      # ADL API (Teammate)
├── store/
│   ├── auth_store.dart           # Login session
│   └── module_store.dart         # Active module (SENTRY/ADL)
├── features/
│   ├── auth/                     # Login, Signup, OTP, Onboarding (shared)
│   ├── module/                   # Module select screen (shared)
│   ├── sentry/                   # SENTRY screens (Harishalinee)
│   └── adl/                      # ADL screens (Teammate)
├── navigation/
│   ├── app_router.dart           # Root navigation
│   ├── sentry_nav.dart           # SENTRY bottom nav
│   └── adl_nav.dart              # ADL bottom nav
└── widgets/                      # Shared UI components (both use)
    ├── module_switcher_pill.dart  # 🛡 SENTRY ⌄ pill in top bar
    ├── module_switcher_sheet.dart # Bottom sheet to switch modules
    ├── risk_badge.dart            # HIGH/MOD/LOW badge
    └── loading_spinner.dart
```

## Connecting to Backend

When backend is ready, update `lib/core/config/api_config.dart`:
```dart
static const String baseUrl = 'https://your-backend-url.com';
```
Then replace mock data in `sentry_service.dart` / `adl_service.dart` with real Dio calls.
