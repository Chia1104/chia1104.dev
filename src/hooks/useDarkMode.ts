import { useLocalStorage, useMediaQuery, useUpdateEffect } from "usehooks-ts";
import { useTheme } from "next-themes";

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

interface UseDarkModeOutput {
  isDarkMode: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

export default function useDarkMode(defaultValue?: boolean): UseDarkModeOutput {
  const isDarkOS = useMediaQuery(COLOR_SCHEME_QUERY);
  const [isDarkMode, setDarkMode] = useLocalStorage<boolean>(
    "usehooks-ts-dark-mode",
    defaultValue ?? isDarkOS ?? false
  );
  const { theme, setTheme } = useTheme();

  useUpdateEffect(() => {
    setTheme(isDarkOS ? "dark" : "light");
  }, [isDarkOS]);

  return {
    isDarkMode: theme === "dark",
    toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
    enable: () => setTheme("dark"),
    disable: () => setTheme("light"),
  };
}
