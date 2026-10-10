# Asset placeholders

The app deliberately ships **without** icon and splash images so a fresh
checkout requires no binary assets.

To add branded art:

1. Put a `1024×1024` PNG here as `icon.png`.
2. (Optional) a `splash.png` for the splash screen.
3. In `../app.json`, add the fields:

   ```json
   "icon": "./assets/icon.png",
   "splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#2a1a12" }
   ```

Until then Expo uses its default icon, which is fine for development.