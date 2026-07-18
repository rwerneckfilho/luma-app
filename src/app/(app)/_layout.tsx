import type { Href } from "expo-router";
import { Redirect, router, Tabs } from "expo-router";
import { Clock3, HeartHandshake, House, Pill, UserRound } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/useAuth";
import { colors } from "../../design/theme";
import { takePendingNotificationRoute } from "../../notifications/pendingRoute";

export default function AppLayout() {
  const { session } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!session) return;
    void takePendingNotificationRoute()
      .then((route) => {
        if (route) router.push(route as Href);
      })
      .catch(() => undefined);
  }, [session]);

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
          title: t("nav.home"),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          tabBarIcon: ({ color, size }) => <Pill color={color} size={size} />,
          title: t("nav.medications"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ color, size }) => <Clock3 color={color} size={size} />,
          title: t("nav.history"),
        }}
      />
      <Tabs.Screen
        name="caregivers"
        options={{
          tabBarIcon: ({ color, size }) => <HeartHandshake color={color} size={size} />,
          title: t("nav.caregivers"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
          title: t("nav.profile"),
        }}
      />
    </Tabs>
  );
}
