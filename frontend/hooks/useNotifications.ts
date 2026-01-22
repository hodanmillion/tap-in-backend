import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';

type NotificationsModuleType = typeof import('expo-notifications');
type NotificationSubscription = { remove: () => void };

let NotificationsModule: NotificationsModuleType | null = null;
let notificationHandlerSet = false;

async function getNotifications(): Promise<NotificationsModuleType | null> {
  if (NotificationsModule) return NotificationsModule;
  if (Platform.OS === 'web') return null;
  try {
    NotificationsModule = await import('expo-notifications');
    return NotificationsModule;
  } catch (e) {
    console.warn('Failed to load expo-notifications:', e);
    return null;
  }
}

async function setupNotificationHandler() {
  if (notificationHandlerSet) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      notificationHandlerSet = true;
    } catch (e) {
    console.warn('Failed to set notification handler:', e);
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<unknown>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const notificationListener = useRef<NotificationSubscription | null>(null);
  const responseListener = useRef<NotificationSubscription | null>(null);
  const initialized = useRef(false);

  const registerForPushNotificationsAsync = useCallback(async () => {
    const Notifications = await getNotifications();
    if (!Notifications) return null;

    if (!Device.isDevice) {
      console.log('Push notifications are not available on simulator/emulator');
      return null;
    }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366f1',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      setPermissionStatus(existingStatus);

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        setPermissionStatus(status);
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.log('No projectId found in eas config');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }, []);

  const savePushTokenToServer = useCallback(async (token: string) => {
    if (!user?.id || !token) return;

    try {
      await apiRequest('/push-tokens', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          token,
          platform: Platform.OS,
        }),
      });
      // Optionally update local profile state or refetch profile here if needed
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }, [user?.id]);

  const requestPermissions = useCallback(async () => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      setExpoPushToken(token);
      await savePushTokenToServer(token);
    }
    return token;
  }, [registerForPushNotificationsAsync, savePushTokenToServer]);

  useEffect(() => {
    if (initialized.current) return;
    if (Platform.OS === 'web') return;
    
    let isMounted = true;

    const initNotifications = async () => {
      try {
        await setupNotificationHandler();
        
        if (!isMounted) return;

        const Notifications = await getNotifications();
        if (!Notifications || !isMounted) return;

          notificationListener.current = Notifications.addNotificationReceivedListener((notif: unknown) => {
            if (isMounted) setNotification(notif);
          });

          responseListener.current = Notifications.addNotificationResponseReceivedListener((response: { notification: { request: { content: { data: unknown } } } }) => {
            const data = response.notification.request.content.data;
            console.log('Notification response data:', data);
          });
      } catch (e) {
        console.warn('Failed to initialize notifications:', e);
      }
    };

    initNotifications();
    initialized.current = true;

    return () => {
      isMounted = false;
      try {
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      } catch (e) {
        console.warn('Failed to remove notification listeners:', e);
      }
    };
  }, []);

  const schedulePushNotification = useCallback(async (title: string, body: string, data?: Record<string, unknown>) => {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Failed to schedule notification:', e);
    }
  }, []);

  return {
    expoPushToken,
    notification,
    permissionStatus,
    requestPermissions,
    schedulePushNotification,
  };
}
