# FRIENDSPACE — Internet + APK starter

Bu paket FRIENDSPACE'ni internetga chiqarish va keyin Android APK sifatida o‘rash uchun tayyorlangan.

## 1) GitHub + Render

1. GitHub'da yangi repository yarating.
2. Ushbu papkadagi fayllarni repository'ga yuklang.
3. Render'da **New → Blueprint** orqali repository'ni ulang. `render.yaml` web service va PostgreSQL'ni birga yaratadi.
4. Deploy tugagach Render sizga `https://....onrender.com` URL beradi.
5. Saytni shu URL bilan oching.

### Muhim
- Free Render Web Service 15 daqiqa faoliyat bo‘lmasa sleep qiladi va keyingi kirishda taxminan bir daqiqada uyg‘onishi mumkin.
- Free Render Postgres 1 GB va 30 kundan keyin tugaydi; doimiy foydalanish uchun database planini keyin upgrade qilish kerak.
- `render.yaml`dagi `DATABASE_URL` avtomatik ravishda Postgres connection string bilan to‘ldiriladi.
- Admin boshlang‘ich login: **badbro**
- Admin boshlang‘ich parol: **badbro123**
- Birinchi deploydan keyin Admin Panel orqali parolni almashtiring.

## 2) Android APK

`mobile` papkasida Capacitor wrapper bor. Avval yuqoridagi Render URL tayyor bo‘lsin. Keyin `mobile/capacitor.config.ts` ichidagi `server.url` ni o‘z Render URL'ingizga almashtiring.

Kompyuterda Node.js va Android Studio o‘rnatilgan bo‘lishi kerak. `mobile` papkasida:

```bash
npm install
npx cap add android
npx cap copy
npx cap open android
```

Android Studio ochilgach **Build → Generate App Bundles or APKs → Generate APKs** orqali APK yaratasiz. APK telefonlarga alohida o‘rnatilishi mumkin.

## 3) Do‘stlarga tarqatish

APK'ni do‘stlaringizga yuborasiz. Ular o‘rnatgach ilova ikonkasini bosadi va siz yaratgan login/parol bilan kiradi. Ilova internetdagi FRIENDSPACE serveriga ulanadi, shuning uchun chat turli telefonlarda ishlaydi.

## Local test

`DATABASE_URL` bo‘lmasa server eski kabi `friendspace-data.json` orqali local ishlaydi:

```bash
npm install
npm start
```

Brauzer: `http://localhost:3000`
