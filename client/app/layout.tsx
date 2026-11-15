import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ScholarHub", template: "%s | ScholarHub" },
  description: "Learn from approved courses by expert instructors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <Navbar />
          {children}
          <footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
            ScholarHub, a MERN stack assignment project
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}