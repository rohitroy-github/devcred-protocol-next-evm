import { Montserrat, Geist_Mono } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "DevCred Protocol - Blockchain Developer Credentials & Job Escrow",
    template: "%s | DevCred Protocol",
  },
  description:
    "DevCred Protocol is a decentralized platform for developer profiles, job escrow, and reputation tracking on-chain. Secure freelance work with smart contract-backed payments and transparent reputation scores.",
  keywords: [
    "blockchain",
    "developer",
    "freelance",
    "escrow",
    "smart contracts",
    "reputation",
    "web3",
    "ethereum",
    "defi",
    "credentials",
  ],
  authors: [{ name: "DevCred Protocol" }],
  creator: "DevCred Protocol",
  publisher: "DevCred Protocol",
  robots: "index, follow",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://devcred.protocol",
    siteName: "DevCred Protocol",
    title: "DevCred Protocol - Blockchain Developer Credentials & Job Escrow",
    description:
      "Secure freelance work with on-chain profiles, escrow payments, and transparent reputation. The protocol-first platform for developer credentials.",
    images: [
      {
        url: "https://devcred.protocol/og-image.png",
        width: 1200,
        height: 630,
        alt: "DevCred Protocol",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DevCred Protocol",
    description:
      "Blockchain-powered developer credentials, freelance jobs, and smart contract escrow.",
    images: ["https://devcred.protocol/twitter-image.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
