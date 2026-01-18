import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotifications() {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const registerForPushNotificationsAsync = useCallback(async () => {
    if (!Device.isDevice) {
      console.log('Push notifications are not available on simulator/emulator');
      return null;
    }

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

    try {
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
    if (user?.id) {
      requestPermissions();
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('Notification response data:', data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user?.id, requestPermissions]);

  const schedulePushNotification = useCallback(async (title: string, body: string, data?: object) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null,
    });
  }, []);

  return {
    expoPushToken,
    notification,
    permissionStatus,
    requestPermissions,
    schedulePushNotification,
  };
}
