# FRIENDSPACE Android APK

1. `capacitor.config.ts` dagi `server.url` ni Render'dagi haqiqiy FRIENDSPACE URL'iga almashtiring.
2. Android Studio va JDK o‘rnatilgan bo‘lsin.
3. Terminalda:

```bash
npm install
npx cap add android
npx cap copy
npx cap open android
```

4. Android Studio'da `Build → Generate App Bundles or APKs → Generate APKs`.
5. Hosil bo‘lgan APK'ni Android telefonlarga o‘rnating.

Bu wrapper saytni alohida Android ilova oynasida ochadi; login va chat internetdagi server orqali ishlaydi.
