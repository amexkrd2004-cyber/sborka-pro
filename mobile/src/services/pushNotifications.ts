import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function resolveProjectId(): string | undefined {
  const byEasConfig = Constants?.easConfig?.projectId;
  if (typeof byEasConfig === 'string' && byEasConfig.trim()) return byEasConfig.trim();

  const byExpoConfig = (Constants?.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)
    ?.extra?.eas?.projectId;
  if (typeof byExpoConfig === 'string' && byExpoConfig.trim()) return byExpoConfig.trim();
  return undefined;
}

export function isExpoGoRuntime(): boolean {
  // SDK 54: в Expo Go remote push через expo-notifications недоступен.
  const byExecutionEnv = Constants.executionEnvironment === 'storeClient';
  const byOwnership = Constants.appOwnership === 'expo';
  return Boolean(byExecutionEnv || byOwnership);
}

/** Каналы Android: вызывать при старте приложения, до прихода push. */
export async function ensureNotificationChannels(): Promise<void> {
  if (isExpoGoRuntime()) return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Заказы в сборке',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1A5FB4',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('urgent', {
    name: 'Срочно: заказ не взят',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lightColor: '#FF0000',
    sound: 'default',
  });
}

export async function registerExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }
  if (isExpoGoRuntime()) {
    console.log('[push] Expo Go detected: remote push registration skipped');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    finalStatus = req.status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  await ensureNotificationChannels();

  const projectId = resolveProjectId();
  const tokenResult = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return tokenResult.data;
}

