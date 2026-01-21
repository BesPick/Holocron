import type { ReactNode } from 'react';

export const metadata = {
  title: 'Morale | BESPIN Holocron',
};

type MoraleLayoutProps = {
  children: ReactNode;
};

export default function MoraleLayout({ children }: MoraleLayoutProps) {
  return <>{children}</>;
}
