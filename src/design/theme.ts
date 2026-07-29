import { Platform } from "react-native";

export const colors = {
  background: "#FAFAF7",
  border: "#BDC9CA",
  borderSoft: "rgba(189, 201, 202, 0.2)",
  danger: "#BA1A1A",
  dangerSoft: "#FFDAD6",
  ink: "#061B2C",
  muted: "#3E494A",
  outline: "#6E797A",
  primary: "#007680",
  primaryPressed: "#005C63",
  primarySoft: "#D7F2E6",
  secondary: "#5BAA8C",
  secondaryInk: "#00513C",
  surface: "#FFFFFF",
  surfaceContainer: "#ECEEED",
  surfaceMuted: "#F3F5F4",
  surfaceVariant: "#E1E3E2",
  warning: "#8A5C00",
  warningSoft: "#FFF3CD",
  success: "#177245",
  successSoft: "#DDF5E7",
  overlay: "rgba(6, 27, 44, 0.42)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 } as const;
export const radii = { sm: 8, md: 16, lg: 24, pill: 999 } as const;

export const fonts = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  heading: "Manrope_600SemiBold",
  headingBold: "Manrope_700Bold",
  fallback: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
} as const;

export const shadows = {
  card: Platform.select({
    ios: { shadowColor: "#061B2C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 14 },
    android: { elevation: 2 },
    default: {},
  }),
  floating: Platform.select({
    ios: { shadowColor: "#061B2C", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

export const layout = {
  authMaxWidth: 448,
  careMaxWidth: 896,
  contentMaxWidth: 1024,
  headerHeight: 72,
  profileMaxWidth: 672,
  tabletBreakpoint: 768,
} as const;
