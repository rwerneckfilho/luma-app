import { BlurView } from "expo-blur";
import { router, usePathname } from "expo-router";
import { History, House, Pill, UserCircle, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { colors, fonts, layout, radii, shadows, spacing } from "../../design/theme";
import { LumaLogo } from "./LumaLogo";

type TabBarProps = {
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: { navigate: (name: string, params?: object) => void };
  state: {
    index: number;
    routes: { key: string; name: string; params?: object }[];
  };
};

const destinations = [
  { name: "home", path: "/(app)/home", icon: House, label: "nav.home" },
  { name: "medications", path: "/(app)/medications", icon: Pill, label: "nav.medications" },
  { name: "history", path: "/(app)/history", icon: History, label: "nav.history" },
  { name: "caregivers", path: "/(app)/caregivers", icon: UsersRound, label: "nav.caregivers" },
] as const;

export function AppHeader() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { t } = useTranslation();
  const wide = width >= layout.tabletBreakpoint;
  const profileActive = pathname.includes("profile");

  return (
    <SafeAreaView edges={["top"]} style={styles.headerSafe}>
      <BlurView intensity={86} tint="light" style={styles.headerBlur}>
        <View style={styles.headerInner}>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/(app)/home")}>
            <LumaLogo />
          </Pressable>
          {wide ? (
            <View style={styles.desktopNav}>
              {destinations.map(({ icon: Icon, label, path }) => {
                const active = pathname.includes(path.split("/").at(-1) ?? "");
                return (
                  <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={path} onPress={() => router.push(path)} style={[styles.desktopNavItem, active && styles.desktopNavItemActive]}>
                    <Icon color={active ? colors.surface : colors.muted} size={18} />
                    <Text style={[styles.desktopNavText, active && styles.desktopNavTextActive]}>{t(label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Pressable accessibilityLabel={t("nav.profile")} accessibilityRole="button" accessibilityState={{ selected: profileActive }} onPress={() => router.push("/(app)/profile")} style={[styles.profileButton, profileActive && styles.profileButtonActive]}>
            <UserCircle color={profileActive ? colors.primary : colors.muted} size={24} />
          </Pressable>
        </View>
      </BlurView>
    </SafeAreaView>
  );
}

export function LumaTabBar({ descriptors, navigation, state }: TabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (width >= layout.tabletBreakpoint) return null;
  const visibleRoutes = state.routes.filter((route) => destinations.some((item) => item.name === route.name));

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <BlurView intensity={92} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.tabBar}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((item) => item.key === route.key);
          const focused = state.index === routeIndex;
          const item = destinations.find((destination) => destination.name === route.name)!;
          const Icon = item.icon;
          const label = String(descriptors[route.key]?.options.title ?? route.name);
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onPress={() => navigation.navigate(route.name, route.params)}
              style={[styles.tabItem, focused && styles.tabItemActive]}
            >
              <View style={styles.tabIcon}><Icon color={focused ? colors.surface : colors.muted} size={21} /></View>
              <Text numberOfLines={1} style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopNav: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.xs, justifyContent: "center" },
  desktopNavItem: { alignItems: "center", borderRadius: radii.pill, flexDirection: "row", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  desktopNavItemActive: { backgroundColor: colors.primary },
  desktopNavText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 14 },
  desktopNavTextActive: { color: colors.surface, fontFamily: fonts.bodyBold },
  headerBlur: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  headerInner: { alignItems: "center", alignSelf: "center", flexDirection: "row", height: layout.headerHeight, justifyContent: "space-between", maxWidth: layout.contentMaxWidth, paddingHorizontal: spacing.lg, width: "100%" },
  headerSafe: { backgroundColor: "rgba(250,250,247,0.94)" },
  profileButton: { alignItems: "center", borderRadius: radii.pill, height: 48, justifyContent: "center", width: 48 },
  profileButtonActive: { backgroundColor: colors.primarySoft },
  tabBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-around", minHeight: 64 },
  tabBarWrap: { backgroundColor: "rgba(255,255,255,0.9)", borderTopColor: colors.border, borderTopWidth: 1, ...shadows.floating },
  tabIcon: { alignItems: "center", borderRadius: radii.pill, height: 30, justifyContent: "center", width: 50 },
  tabItem: { alignItems: "center", borderRadius: radii.pill, flex: 1, gap: 2, minHeight: 56, justifyContent: "center", marginHorizontal: 2, paddingHorizontal: spacing.xs },
  tabItemActive: { backgroundColor: colors.primary, ...shadows.card },
  tabLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  tabLabelActive: { color: colors.surface, fontFamily: fonts.bodyBold },
});
