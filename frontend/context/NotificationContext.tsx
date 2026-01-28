import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiRequest } from '@/lib/api';

interface NotificationContextType {
  expoPushToken: string | undefined;
  notification: Notifications.Notification | undefined;
  requestPermissions: () => Promise<string | undefined>;
  permissionStatus: Notifications.PermissionStatus | undefined;
  schedulePushNotification: (title: string, body: string, data?: any) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | undefined>(undefined);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const schedulePushNotification = async (title: string, body: string, data?: any) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
      },
      trigger: null, // show immediately
    });
  };

  const handleNotificationRouting = (data: any) => {
    if (!data) return;

    if (data.room_id) {
      router.push(`/chat/${data.room_id}`);
    } else if (data.type === 'friend_request') {
      router.push('/friend-requests');
    } else if (data.type === 'friend_request_accepted' || data.type === 'friend_accept') {
      router.push('/(tabs)/friends');
    }
  };

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      
      const { title, body, data } = notification.request.content;
      
      // Show in-app alert when foregrounded
      if (data) {
        Alert.alert(
          title || 'New Notification',
          body || '',
          [
            { text: 'Ignore', style: 'cancel' },
            { 
              text: 'View', 
              onPress: () => handleNotificationRouting(data)
            }
          ]
        );
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      handleNotificationRouting(data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const registerForPushNotificationsAsync = async () => {
    let token;
    if (Platform.OS === 'web') return;

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      setPermissionStatus(finalStatus as Notifications.PermissionStatus);
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  };

    const requestPermissions = async (retryCount = 0) => {
      const token = await registerForPushNotificationsAsync();
      if (token && user?.id) {
        setExpoPushToken(token);
        try {
          await apiRequest('/push-tokens', {
            method: 'POST',
            body: JSON.stringify({
              user_id: user.id,
              token: token,
              platform: Platform.OS,
            }),
          });
        } catch (error: any) {
          // If it's a foreign key error, it might be a race condition where the user 
          // is authenticated but not yet fully "visible" to the public schema's constraints.
          if (error.message?.includes('foreign key constraint') && retryCount < 2) {
            console.log(`Push token save failed (FK constraint), retrying in 2s... (attempt ${retryCount + 1})`);
            setTimeout(() => requestPermissions(retryCount + 1), 2000);
          } else {
            console.error('Error saving push token:', error);
          }
        }
      }
      return token;
    };

  return (
    <NotificationContext.Provider value={{ expoPushToken, notification, requestPermissions, permissionStatus, schedulePushNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
