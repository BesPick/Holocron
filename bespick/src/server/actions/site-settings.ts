'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';

import {
  getHostHubEventLabel,
  getSecurityShiftWindow,
  isHostHubEventType,
  isSecurityShiftEventType,
  type HostHubEventType,
} from '@/lib/hosthub-events';
import {
  formatShortDateLabel,
  resolveEventTime,
} from '@/lib/hosthub-schedule-utils';
import { checkRole } from '@/server/auth/check-role';
import { getPrimaryEmail } from '@/server/auth';
import {
  findMattermostUserIdByEmail,
  isMattermostConfigured,
  postMattermostDirectMessage,
} from '@/server/integrations/mattermost';
import { getScheduleRuleConfig } from '@/server/services/hosthub-schedule';
import {
  saveProfileWarningConfig,
  saveWarningBannerConfig,
  saveMattermostNotificationConfig,
  type MattermostNotificationConfig,
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

export type UpdateMattermostNotificationResult = {
  success: boolean;
  message: string;
  config?: MattermostNotificationConfig;
};

export type SendMattermostTestResult = {
  success: boolean;
  message: string;
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

export async function updateMattermostNotifications(
  config: MattermostNotificationConfig,
): Promise<UpdateMattermostNotificationResult> {
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      message: 'You are not authorized to update site settings.',
    };
  }

  try {
    const { userId } = await auth();
    const updatedConfig = await saveMattermostNotificationConfig({
      config,
      updatedBy: userId ?? null,
    });

    return {
      success: true,
      message: 'Mattermost notification settings updated.',
      config: updatedConfig,
    };
  } catch (error) {
    console.error('Failed to update Mattermost notifications', error);
    return {
      success: false,
      message: 'Updating Mattermost notifications failed. Please try again.',
    };
  }
}

const formatTimeLabel = (time: string) => {
  if (!time || time === 'TBD') return 'TBD';
  const [hoursRaw, minutesRaw] = time.split(':').map(Number);
  if (
    Number.isNaN(hoursRaw) ||
    Number.isNaN(minutesRaw) ||
    hoursRaw < 0 ||
    hoursRaw > 23 ||
    minutesRaw < 0 ||
    minutesRaw > 59
  ) {
    return time;
  }
  const suffix = hoursRaw >= 12 ? 'PM' : 'AM';
  const hours = hoursRaw % 12 || 12;
  return `${hours}:${String(minutesRaw).padStart(2, '0')} ${suffix}`;
};

const formatTimeRangeLabel = (startTime: string, endTime: string) => {
  const startLabel = formatTimeLabel(startTime);
  const endLabel = formatTimeLabel(endTime);
  if (startLabel === 'TBD' || endLabel === 'TBD') return 'TBD';
  return `${startLabel} - ${endLabel}`;
};

const getAppBaseUrl = () => {
  const raw =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    null;
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
};

export async function sendMattermostTestDm({
  targetUserId,
  eventType,
}: {
  targetUserId: string;
  eventType: HostHubEventType;
}): Promise<SendMattermostTestResult> {
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      message: 'You are not authorized to send test notifications.',
    };
  }

  if (!isMattermostConfigured()) {
    return {
      success: false,
      message:
        'Mattermost is not configured. Set MATTERMOST_URL and MATTERMOST_BOT_TOKEN.',
    };
  }

  if (!targetUserId.trim()) {
    return {
      success: false,
      message: 'Select a user before sending a test DM.',
    };
  }

  if (!isHostHubEventType(eventType)) {
    return {
      success: false,
      message: 'Select a valid event type before sending a test DM.',
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      message: 'You must be signed in to send a test notification.',
    };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(targetUserId);
    const email = getPrimaryEmail(user);
    if (!email) {
      return {
        success: false,
        message: 'No email found for the selected user.',
      };
    }

    const mattermostUserId =
      (await findMattermostUserIdByEmail(email)) ?? '';
    if (!mattermostUserId) {
      return {
        success: false,
        message:
          'No Mattermost user found for that email address.',
      };
    }

    const date = new Date();
    date.setDate(date.getDate() + 1);
    const dateLabel = formatShortDateLabel(date);
    const label = (() => {
      if (isSecurityShiftEventType(eventType)) {
        const window = getSecurityShiftWindow(eventType);
        return window ? `${window.label} Security` : 'Security Shift';
      }
      return getHostHubEventLabel(eventType);
    })();

    let timeLabel = 'TBD';
    if (isSecurityShiftEventType(eventType)) {
      const window = getSecurityShiftWindow(eventType);
      if (window) {
        timeLabel = formatTimeRangeLabel(
          window.startTime,
          window.endTime,
        );
      }
    } else {
      const ruleId = eventType === 'demo' ? 'demo-day' : 'standup';
      const rule = await getScheduleRuleConfig(ruleId);
      timeLabel = formatTimeLabel(resolveEventTime(null, rule.defaultTime));
    }

    const baseUrl = getAppBaseUrl();
    const docsUrl = baseUrl
      ? new URL('/hosthub/docs', baseUrl).toString()
      : null;
    const message = [
      `Test notification: You are scheduled for ${label} on ${dateLabel} at ${timeLabel}.`,
      'This is a test DM sent from Settings.',
      docsUrl ? `Details: ${docsUrl}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const result = await postMattermostDirectMessage(
      mattermostUserId,
      message,
    );
    if (!result) {
      return {
        success: false,
        message:
          'Failed to send the test DM. Check bot permissions and token.',
      };
    }

    return {
      success: true,
      message: 'Test DM sent. Check your Mattermost inbox.',
    };
  } catch (error) {
    console.error('Failed to send test Mattermost DM', error);
    return {
      success: false,
      message: 'Sending the test DM failed. Please try again.',
    };
  }
}
