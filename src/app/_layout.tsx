import "react-native-gesture-handler";
import "../notifications/backgroundTask";
import { StatusBar } from "expo-status-bar";
import { RootNavigator } from "../providers/RootNavigator";
import { AppProviders } from "../providers/AppProviders";

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProviders>
  );
}
