import { Stack } from 'expo-router';

export default function AuthFolderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="callback" />
    </Stack>
  );
}
