import * as Notifications from 'expo-notifications';

export const scheduleDailyNotifications = async (
  morningHour,
  morningMinute,
  eveningHour,
  eveningMinute
) => {
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Good morning ✦',
      body: 'Your commitments are waiting. Show up as who you are today.',
      sound: true,
    },
    trigger: {
      hour: morningHour,
      minute: morningMinute,
      repeats: true,
    },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Evening reflection ◎',
      body: 'Take a moment to reflect on who you showed up as today.',
      sound: true,
    },
    trigger: {
      hour: eveningHour,
      minute: eveningMinute,
      repeats: true,
    },
  });
};

export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
