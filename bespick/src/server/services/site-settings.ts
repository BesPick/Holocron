import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { siteSettings } from '@/server/db/schema';
import {
  DEFAULT_METADATA_OPTIONS,
  RESERVED_METADATA_SECTION_IDS,
  type MetadataCustomSection,
  type MetadataOptionsConfig,
} from '@/lib/metadata-options';
import type { GroupOption, TeamOption } from '@/lib/org';

export type WarningBannerConfig = {
  enabled: boolean;
  message: string;
};

export type ProfileWarningConfig = {
  enabled: boolean;
};

export type MattermostNotificationConfig = {
  moraleEnabled: boolean;
  hosthubStandupEnabled: boolean;
  hosthubDemoEnabled: boolean;
  hosthubSecurityAmEnabled: boolean;
  hosthubSecurityPmEnabled: boolean;
  hosthubBuilding892Enabled: boolean;
};

const WARNING_BANNER_ID = 'warning-banner';
const PROFILE_WARNING_ID = 'profile-warning';
const MATTERMOST_NOTIFICATIONS_ID = 'mattermost-notifications';
const METADATA_OPTIONS_ID = 'metadata-options';
const DEFAULT_WARNING_BANNER: WarningBannerConfig = {
  enabled: false,
  message: '',
};
const DEFAULT_PROFILE_WARNING: ProfileWarningConfig = {
  enabled: true,
};
const DEFAULT_MATTERMOST_NOTIFICATIONS: MattermostNotificationConfig = {
  moraleEnabled: true,
  hosthubStandupEnabled: true,
  hosthubDemoEnabled: true,
  hosthubSecurityAmEnabled: true,
  hosthubSecurityPmEnabled: true,
  hosthubBuilding892Enabled: true,
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeOptionList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const entry of value) {
    const raw =
      typeof entry === 'string'
        ? entry.trim()
        : entry && typeof entry === 'object' && 'value' in entry
          ? typeof (entry as { value?: unknown }).value === 'string'
            ? (entry as { value: string }).value.trim()
            : ''
          : '';
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    options.push(raw);
  }
  return options;
};

const normalizeGroupOptions = (value: unknown): GroupOption[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const groups: GroupOption[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const rawValue = typeof record.value === 'string' ? record.value.trim() : '';
    const rawLabel = typeof record.label === 'string' ? record.label.trim() : '';
    const groupValue = rawValue || rawLabel;
    if (!groupValue || seen.has(groupValue)) continue;
    const portfolios = normalizeOptionList(record.portfolios);
    groups.push({
      value: groupValue,
      label: rawLabel || groupValue,
      portfolios,
    });
    seen.add(groupValue);
  }
  return groups;
};

const normalizeTeamOptions = (value: unknown): TeamOption[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const teams: TeamOption[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      teams.push({ value: trimmed, label: trimmed });
      seen.add(trimmed);
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const rawValue = typeof record.value === 'string' ? record.value.trim() : '';
    const rawLabel = typeof record.label === 'string' ? record.label.trim() : '';
    const teamValue = rawValue || rawLabel;
    if (!teamValue || seen.has(teamValue)) continue;
    teams.push({ value: teamValue, label: rawLabel || teamValue });
    seen.add(teamValue);
  }
  return teams;
};

const normalizeCustomSections = (value: unknown): MetadataCustomSection[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sections: MetadataCustomSection[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const rawLabel = typeof record.label === 'string' ? record.label.trim() : '';
    const rawId = typeof record.id === 'string' ? record.id.trim() : '';
    const derivedId = rawId || slugify(rawLabel);
    if (!derivedId || RESERVED_METADATA_SECTION_IDS.has(derivedId)) continue;
    if (seen.has(derivedId)) continue;
    const options = normalizeOptionList(record.options);
    sections.push({
      id: derivedId,
      label: rawLabel || derivedId,
      options,
    });
    seen.add(derivedId);
  }
  return sections;
};

const parseJson = (raw: string) => {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    console.error('Failed to parse site settings JSON', error);
    return null;
  }
};

const normalizeWarningBannerConfig = (
  value: unknown,
): WarningBannerConfig => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_WARNING_BANNER;
  }
  const record = value as Record<string, unknown>;
  const message =
    typeof record.message === 'string' ? record.message.trim() : '';
  const enabled = Boolean(record.enabled) && message.length > 0;
  return { enabled, message };
};

const normalizeProfileWarningConfig = (
  value: unknown,
): ProfileWarningConfig => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PROFILE_WARNING;
  }
  const record = value as Record<string, unknown>;
  return {
    enabled: Boolean(record.enabled),
  };
};

const normalizeMattermostNotificationConfig = (
  value: unknown,
): MattermostNotificationConfig => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_MATTERMOST_NOTIFICATIONS;
  }
  const record = value as Record<string, unknown>;
  return {
    moraleEnabled: Boolean(record.moraleEnabled),
    hosthubStandupEnabled: Boolean(record.hosthubStandupEnabled),
    hosthubDemoEnabled: Boolean(record.hosthubDemoEnabled),
    hosthubSecurityAmEnabled: Boolean(record.hosthubSecurityAmEnabled),
    hosthubSecurityPmEnabled: Boolean(record.hosthubSecurityPmEnabled),
    hosthubBuilding892Enabled:
      'hosthubBuilding892Enabled' in record
        ? Boolean(record.hosthubBuilding892Enabled)
        : DEFAULT_MATTERMOST_NOTIFICATIONS.hosthubBuilding892Enabled,
  };
};

const normalizeMetadataOptionsConfig = (
  value: unknown,
): MetadataOptionsConfig => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_METADATA_OPTIONS;
  }
  const record = value as Record<string, unknown>;
  const hasGroupOptions = 'groupOptions' in record;
  const hasTeamOptions = 'teamOptions' in record;
  const groupOptions = normalizeGroupOptions(record.groupOptions);
  const teamOptions = normalizeTeamOptions(record.teamOptions);
  const customSections = normalizeCustomSections(record.customSections);

  return {
    groupOptions: hasGroupOptions
      ? groupOptions
      : DEFAULT_METADATA_OPTIONS.groupOptions,
    teamOptions: hasTeamOptions
      ? teamOptions
      : DEFAULT_METADATA_OPTIONS.teamOptions,
    customSections,
  };
};

export async function getWarningBannerConfig(): Promise<WarningBannerConfig> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, WARNING_BANNER_ID))
    .limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_WARNING_BANNER;
  const parsed = parseJson(row.configJson);
  return normalizeWarningBannerConfig(parsed);
}

export async function saveWarningBannerConfig({
  config,
  updatedBy,
}: {
  config: WarningBannerConfig;
  updatedBy?: string | null;
}): Promise<WarningBannerConfig> {
  const normalized = normalizeWarningBannerConfig(config);
  const payload = {
    id: WARNING_BANNER_ID,
    configJson: JSON.stringify(normalized),
    updatedAt: Date.now(),
    updatedBy: updatedBy ?? null,
  };

  await db
    .insert(siteSettings)
    .values(payload)
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        configJson: payload.configJson,
        updatedAt: payload.updatedAt,
        updatedBy: payload.updatedBy,
      },
    });

  return normalized;
}

export async function getProfileWarningConfig(): Promise<ProfileWarningConfig> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, PROFILE_WARNING_ID))
    .limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_PROFILE_WARNING;
  const parsed = parseJson(row.configJson);
  return normalizeProfileWarningConfig(parsed);
}

export async function saveProfileWarningConfig({
  config,
  updatedBy,
}: {
  config: ProfileWarningConfig;
  updatedBy?: string | null;
}): Promise<ProfileWarningConfig> {
  const normalized = normalizeProfileWarningConfig(config);
  const payload = {
    id: PROFILE_WARNING_ID,
    configJson: JSON.stringify(normalized),
    updatedAt: Date.now(),
    updatedBy: updatedBy ?? null,
  };

  await db
    .insert(siteSettings)
    .values(payload)
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        configJson: payload.configJson,
        updatedAt: payload.updatedAt,
        updatedBy: payload.updatedBy,
      },
    });

  return normalized;
}

export async function getMattermostNotificationConfig(): Promise<MattermostNotificationConfig> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, MATTERMOST_NOTIFICATIONS_ID))
    .limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_MATTERMOST_NOTIFICATIONS;
  const parsed = parseJson(row.configJson);
  return normalizeMattermostNotificationConfig(parsed);
}

export async function saveMattermostNotificationConfig({
  config,
  updatedBy,
}: {
  config: MattermostNotificationConfig;
  updatedBy?: string | null;
}): Promise<MattermostNotificationConfig> {
  const normalized = normalizeMattermostNotificationConfig(config);
  const payload = {
    id: MATTERMOST_NOTIFICATIONS_ID,
    configJson: JSON.stringify(normalized),
    updatedAt: Date.now(),
    updatedBy: updatedBy ?? null,
  };

  await db
    .insert(siteSettings)
    .values(payload)
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        configJson: payload.configJson,
        updatedAt: payload.updatedAt,
        updatedBy: payload.updatedBy,
      },
    });

  return normalized;
}

export async function getMetadataOptionsConfig(): Promise<MetadataOptionsConfig> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, METADATA_OPTIONS_ID))
    .limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_METADATA_OPTIONS;
  const parsed = parseJson(row.configJson);
  return normalizeMetadataOptionsConfig(parsed);
}

export async function saveMetadataOptionsConfig({
  config,
  updatedBy,
}: {
  config: MetadataOptionsConfig;
  updatedBy?: string | null;
}): Promise<MetadataOptionsConfig> {
  const normalized = normalizeMetadataOptionsConfig(config);
  const payload = {
    id: METADATA_OPTIONS_ID,
    configJson: JSON.stringify(normalized),
    updatedAt: Date.now(),
    updatedBy: updatedBy ?? null,
  };

  await db
    .insert(siteSettings)
    .values(payload)
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        configJson: payload.configJson,
        updatedAt: payload.updatedAt,
        updatedBy: payload.updatedBy,
      },
    });

  return normalized;
}
