# SkoolMate OS Design System

## Audience and product

School administrators, teachers, bursars and families at Ugandan schools, including peri-urban and rural schools. Many use low-cost Android phones, intermittent 2G/3G connections and shared devices. Prefer plain English, familiar school terms, large touch controls, low data use, fast first paint, and clear saved / waiting / not-saved states.

## Brand and theme

Preserve the existing SkoolMate visual identity for the first draft: blue primary `#005ce6`, deep blue `#0045ad`, teal `#43b3a3`, light cool surfaces, DM Sans body, Sora headings, and Material Symbols Outlined icons. Support light and dark themes using the existing CSS variables.

## Interface rules

- Mobile-first at 320px width; no horizontal page scroll.
- Main actions use 44px or larger targets, readable body text, and short labels.
- Keep layouts flat and inexpensive to render; avoid blur, video, large decorative images and heavy motion.
- Make offline, queued, syncing, failed and confirmed states distinct with text and icon, never color alone.
- Preserve form values on slow connections and state whether a record is local or server-confirmed.
- Show cached content immediately when available and label freshness honestly.
- Keep role access and school data boundaries unchanged.

