import type { Metadata } from "next";
import "./globals.css";
import { Cursor } from "@/components/Cursor";

export const metadata: Metadata = {
  title: "Field to Still · Moonshiners × Brocksbushes",
  description:
    "Strawberry Gin, Strawberry Liqueur and Pumpkin Spiced Rum. Picked at Brocksbushes Farm, distilled in Newcastle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Cursor />
        {children}
      </body>
    </html>
  );
}
