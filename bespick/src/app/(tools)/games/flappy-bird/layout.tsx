import type { ReactNode } from 'react';

type FlappyBirdLayoutProps = {
  children: ReactNode;
};

export default function FlappyBirdLayout({ children }: FlappyBirdLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Flappy Bird | BESPIN Games</title>
      </head>
      <body className="bg-background text-foreground font-sans antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
