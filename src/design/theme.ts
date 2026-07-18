import { Platform } from "react-native";

export const colors = {
  background: "#FAFAF7",
  border: "#BDC9CA",
  danger: "#BA1A1A",
  dangerSoft: "#FFDAD6",
  ink: "#061B2C",
  muted: "#3E494A",
  primary: "#007680",
  primaryPressed: "#005C63",
  primarySoft: "#D7F2E6",
  surface: "#FFFFFF",
  warning: "#9A6700",
  warningSoft: "#FFF3CD",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 8, md: 16, lg: 24, pill: 999 } as const;

export const fonts = {
  body: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  heading: Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" }),
} as const;
