import type { ConfigContext, ExpoConfig } from "expo/config";
import baseConfig from "./app.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const staticConfig = baseConfig.expo as ExpoConfig;

  return {
    ...config,
    ...staticConfig,
    extra: {
      ...(staticConfig.extra ?? {}),
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
