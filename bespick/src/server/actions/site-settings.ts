'use server';

import { auth } from '@clerk/nextjs/server';

import { checkRole } from '@/server/auth/check-role';
import {
  saveProfileWarningConfig,
  saveWarningBannerConfig,
  type ProfileWarningConfig,
  type WarningBannerConfig,
} from '@/server/services/site-settings';

export type UpdateWarningBannerResult = {
  success: boolean;
  message: string;
  config?: WarningBannerConfig;
};

export type UpdateProfileWarningResult = {
  success: boolean;
  message: string;
  config?: ProfileWarningConfig;
};

export async function updateWarningBanner({
  enabled,
  message,
}: {
  enabled: boolean;
  message: string;
}): Promise<UpdateWarningBannerResult> {
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      message: 'You are not authorized to update site settings.',
    };
  }

  try {
    const { userId } = await auth();
    const config = await saveWarningBannerConfig({
      config: { enabled, message },
      updatedBy: userId ?? null,
    });

    return {
      success: true,
      message: config.enabled
        ? 'Warning banner updated.'
        : 'Warning banner disabled.',
      config,
    };
  } catch (error) {
    console.error('Failed to update warning banner', error);
    return {
      success: false,
      message: 'Updating the warning banner failed. Please try again.',
    };
  }
}

export async function updateProfileWarning({
  enabled,
}: {
  enabled: boolean;
}): Promise<UpdateProfileWarningResult> {
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      message: 'You are not authorized to update site settings.',
    };
  }

  try {
    const { userId } = await auth();
    const config = await saveProfileWarningConfig({
      config: { enabled },
      updatedBy: userId ?? null,
    });

    return {
      success: true,
      message: config.enabled
        ? 'Profile completion warning enabled.'
        : 'Profile completion warning disabled.',
      config,
    };
  } catch (error) {
    console.error('Failed to update profile warning', error);
    return {
      success: false,
      message: 'Updating the profile warning failed. Please try again.',
    };
  }
}
