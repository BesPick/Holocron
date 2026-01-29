import type { ReactNode } from 'react';

type ReactionTimeLayoutProps = {
  children: ReactNode;
};

export default function ReactionTimeLayout({ children }: ReactionTimeLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Reaction Time | BESPIN Games</title>
      </head>
      <body className="bg-background text-foreground font-sans antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
