import type { Metadata, Viewport } from 'next'
import '../styles/demo-fonts.css'
import '../styles/globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://academy.example'),
  title: {
    template: '%s | أكاديميتك للقرآن الكريم',
    default: 'أكاديميتك للقرآن الكريم | Your Academy',
  },
  description:
    'أكاديميتك لتعليم وتحفيظ القرآن الكريم وتدريس أحكام التجويد والتلاوة عبر الإنترنت لكافة الأعمار والمستويات بنخبة من المعلمين والمعلمات ذوي الخبرة والكفاءة.',
  keywords: [
    'أكاديميتك',
    'تحفيظ قرآن كريم',
    'دورة تجويد',
    'تعليم القرآن عن بعد',
    'Your Academy',
    'Online Quran Memorization',
    'Tajweed Course',
    'Quran Recitation',
  ],
  authors: [{ name: 'Your Academy' }],
  creator: 'Your Academy',
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    alternateLocale: 'en_US',
    siteName: 'أكاديميتك للقرآن الكريم | Your Academy',
    images: [{ url: '/logo.png', width: 800, height: 800, alt: 'Your Academy Logo' }],
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem('academy_demo-theme');
                if (stored === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (e) {}

              try {
                if (typeof MutationObserver !== 'undefined') {
                  const observer = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                      for (const node of m.addedNodes) {
                        if (
                          node.nodeType === 1 &&
                          (node.id?.includes('dz-') ||
                           node.className?.toString?.().includes('dz-container') ||
                           node.id?.includes('acjicnehenlkmfnfpbjbpfnjegbelbpj'))
                        ) {
                          node.remove();
                        }
                      }
                    }
                  });
                  observer.observe(document.documentElement, { childList: true, subtree: true });
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`font-arabic antialiased bg-[#f8fafc] dark:bg-[#0b1628] text-[#0f2744] dark:text-[#e8f0fb] transition-colors duration-200`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
