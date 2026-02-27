import { Alert, Platform, Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import { apiRequest } from '@/lib/query-client';

/**
 * CulturePassAU Sydney Report System v2.0
 * Sydney safety + Kerala community moderation
 */

export type ReportTarget = 
  | 'event' 
  | 'community' 
  | 'profile' 
  | 'post' 
  | 'user'
  | 'business' 
  | 'venue'
  | 'comment';

export interface ReportReason {
  id: string;
  label: string;
  description: string;
}

export const ReportReasons: Record<ReportTarget, ReportReason[]> = {
  event: [
    { id: 'spam', label: 'Spam or irrelevant', description: 'Event seems automated or off-topic' },
    { id: 'inappropriate', label: 'Inappropriate content', description: 'Hate speech, violence, or explicit material' },
    { id: 'fake', label: 'Fake/scam event', description: "Doesn't seem like a real event" },
    { id: 'other', label: 'Other reason', description: 'Something else' },
  ],
  community: [
    { id: 'spam', label: 'Spam community', description: 'Automated or irrelevant posts' },
    { id: 'hate', label: 'Promotes hate', description: 'Discrimination or harmful content' },
    { id: 'fake', label: 'Fake community', description: "Doesn't represent real group" },
    { id: 'other', label: 'Other', description: '' },
  ],
  profile: [
    { id: 'spam', label: 'Spam profile', description: 'Suspicious activity' },
    { id: 'fake', label: 'Fake profile', description: 'Impersonation or bot' },
    { id: 'harassment', label: 'Harassment', description: 'Abusive behavior' },
    { id: 'other', label: 'Other', description: '' },
  ],
  post: [
    { id: 'spam', label: 'Spam post', description: 'Automated content' },
    { id: 'offensive', label: 'Offensive', description: 'Hate speech or abuse' },
    { id: 'misinfo', label: 'Misinformation', description: 'False event details' },
    { id: 'other', label: 'Other', description: '' },
  ],
  user: [
    { id: 'spam', label: 'Spam user', description: 'Suspicious messages' },
    { id: 'harassment', label: 'Harassment', description: 'Repeated abuse' },
    { id: 'fake', label: 'Fake account', description: 'Impersonation' },
    { id: 'other', label: 'Other', description: '' },
  ],
  business: [
    { id: 'fake', label: 'Fake business', description: "Doesn't exist" },
    { id: 'scam', label: 'Scam listing', description: 'Suspicious pricing/offers' },
    { id: 'inaccurate', label: 'Outdated info', description: 'Wrong address/hours' },
    { id: 'other', label: 'Other', description: '' },
  ],
  venue: [
    { id: 'closed', label: 'Venue closed', description: 'No longer operating' },
    { id: 'wrong-info', label: 'Wrong details', description: 'Incorrect address/phone' },
    { id: 'other', label: 'Other', description: '' },
  ],
  comment: [
    { id: 'spam', label: 'Spam comment', description: 'Automated/irrelevant' },
    { id: 'abuse', label: 'Abusive comment', description: 'Personal attacks' },
    { id: 'off-topic', label: 'Off-topic', description: 'Doesn\'t relate to event' },
    { id: 'other', label: 'Other', description: '' },
  ],
};

interface ReportPayload {
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details?: string;
  userAgent?: string;
}

export async function submitReport(payload: ReportPayload): Promise<{ id: string }> {
  const res = await apiRequest('POST', '/api/reports/v2', payload);
  return res.json();
}

export async function submitSydneyReport(
  targetType: ReportTarget, 
  targetId: string,
  reason: string,
  details = ''
): Promise<{ id: string; status: 'submitted' | 'duplicate' | 'escalated' }> {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
  
  try {
    const payload: ReportPayload = {
      targetType,
      targetId,
      reason,
      details,
      userAgent: Platform.OS === 'web' ? navigator.userAgent : 'SydneyApp',
    };
    
    const result = await submitReport(payload);
    return { id: result.id, status: 'submitted' };
  } catch (error: any) {
    if (error.status === 409) {
      return { id: 'duplicate', status: 'duplicate' };
    }
    if (error.status === 503) {
      return { id: 'escalated', status: 'escalated' };
    }
    
    throw error;
  }
}

/**
 * Sydney confirmation dialog
 * Multi-step w/ haptic feedback
 */
export function confirmAndReport(options: {
  targetType: ReportTarget;
  targetId: string;
  reason?: string;
  details?: string;
  title?: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  const {
    targetType,
    targetId,
    reason = ReportReasons[targetType][0].id,
    details,
    title = 'Report Content',
    message = `Are you sure you want to report ${targetId}?`,
    cancelLabel = 'Cancel',
    confirmLabel = 'Report',
    destructive = true,
  } = options;

  Alert.alert(
    title,
    message,
    [
      { text: cancelLabel, style: 'cancel' },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: async () => {
          try {
            const result = await submitSydneyReport(targetType, targetId, reason, details);
            
            let message = 'Thank you! Report submitted.';
            let type: 'success' | 'info' = 'success';
            
            if (result.status === 'duplicate') {
              message = 'This has already been reported.';
              type = 'info';
            } else if (result.status === 'escalated') {
              message = 'Flagged for priority review.';
              type = 'info';
            }
            
            Alert.alert('Report Status', message);
          } catch (error) {
            Alert.alert(
              'Report Failed', 
              'Unable to submit right now. Please try again.',
              [{ text: 'OK' }]
            );
          }
        },
      },
    ],
    { cancelable: true }
  );
}

/**
 * Quick report (Sydney power users)
 * Single-tap w/ preset reason
 */
export function quickReport(
  targetType: ReportTarget,
  targetId: string,
  reasonId: string,
  details?: string
) {
  submitSydneyReport(targetType, targetId, reasonId, details)
    .then(() => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Reported', 'Thank you for keeping our community safe.');
    })
    .catch(() => {
      Alert.alert('Error', 'Failed to report. Please try again.');
    });
}

// Sydney moderation presets
export const SydneyReportPresets = {
  spamEvent: (eventId: string) => 
    quickReport('event', eventId, 'spam', 'Automated or irrelevant event'),
  
  fakeProfile: (userId: string) => 
    quickReport('profile', userId, 'fake', 'Impersonation or bot account'),
};

