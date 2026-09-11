import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

function withTransparentBackground(theme: Theme): Theme {
  return {
    ...theme,
    colors: {
      ...theme.colors,
      background: "transparent",
    },
  };
}

/**
 * Lets navigator scenes reveal the shell-level BackgroundHost. The literal is
 * intentionally localized in the theme directory so all screen components
 * continue to resolve colors through their active palette tokens.
 */
export const navigationTheme = {
  dark: withTransparentBackground(DarkTheme),
  light: withTransparentBackground(DefaultTheme),
} as const;
