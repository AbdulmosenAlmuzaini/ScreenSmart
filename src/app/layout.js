import { LanguageProvider } from "@/translations/LanguageContext";
import "./globals.css";

export const metadata = {
  title: "SmartScreen - Interactive CMS Platform",
  description: "Modern, secure Content Management System (CMS) for digital interactive signs and displays.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
