import { Stack } from 'expo-router';

/** Registration flow stack (company → form → otp steps are state within the screen). */
export default function RegisterLayout() {
  return <Stack screenOptions={{ headerShown: true }} />;
}