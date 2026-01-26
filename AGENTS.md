## Project Summary
TapIn is a mobile-first social application built with React Native (Expo) and a Hono backend. It focuses on proximity-based social interactions, allowing users to discover nearby profiles and rooms, share ephemeral photos ("TapIns"), and engage in real-time chat within location-restricted zones.

## Tech Stack
- **Frontend**: React Native, Expo, Expo Router, NativeWind (Tailwind CSS), TanStack Query (React Query), Lucide Icons.
- **Backend**: Hono (running on Node.js/Bun), Supabase (Auth, Database, Storage - Project: `pcthejcpujqtnurpdmxs`), Resend (Transactional Emails), Expo Push Notifications. Hosted on Render for production.
- **Communication**: REST API for data, Supabase Realtime for live updates. Primary API URL: `https://tap-in-backend.onrender.com`.


## User Preferences
- (None yet)

## Project Guidelines
- Mobile-first design optimized for 349x721px.
- Use NativeWind for all styling.
- Follow Expo Router conventions for navigation.
- Implement proper loading/error states using React Query.
- Ensure cross-platform compatibility (iOS/Android) and web preview support.
- **Store Submission**: Use the official bundle ID `com.TapIn.myapp` for App Store and Play Store releases. Ensure accurate iPhone screenshots (6.5" and 5.5") are included to avoid 2.3.6 rejections.
- **Metadata**: App name should accurately reflect functionality. Use `frontend/app/previews.tsx` to generate store-ready screenshots.

## Common Patterns
- Proximity-based room access: Users must be within a specific radius (e.g., 500m) to send messages in public rooms.
- Ephemeral sharing: "TapIns" expire after 24 hours.
- Transactional emails: Welcome emails sent via Resend upon registration.
