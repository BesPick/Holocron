'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import {
  DEFAULT_METADATA_OPTIONS,
  type MetadataOptionsConfig,
} from '@/lib/metadata-options';

type MetadataOptionsProviderProps = {
  options?: MetadataOptionsConfig;
  children: ReactNode;
};

const MetadataOptionsContext = createContext<MetadataOptionsConfig>(
  DEFAULT_METADATA_OPTIONS,
);

export function MetadataOptionsProvider({
  options,
  children,
}: MetadataOptionsProviderProps) {
  return (
    <MetadataOptionsContext.Provider
      value={options ?? DEFAULT_METADATA_OPTIONS}
    >
      {children}
    </MetadataOptionsContext.Provider>
  );
}

export function useMetadataOptions() {
  return useContext(MetadataOptionsContext);
}
