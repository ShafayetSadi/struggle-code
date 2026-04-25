import { Chalk } from "chalk";

export const chalk = new Chalk({ level: 3 });

export const P = {
  bg: "#0d1117",
  bgPanel: "#161b22",
  bgUser: "#0d2137",
  bgAssistant: "#12201a",
  bgError: "#200d14",
  bgSystem: "#161b22",

  borderSubtle: "#21262d",
  borderMedium: "#30363d",
  borderAccent: "#58a6ff",

  textPrimary: "#e6edf3",
  textSecondary: "#8b949e",
  textMuted: "#484f58",

  blue: "#58a6ff",
  green: "#3fb950",
  yellow: "#d29922",
  orange: "#f0883e",
  purple: "#a371f7",
  red: "#f85149",
  teal: "#39d353",

  modeGuided: { bg: "#1f6feb", fg: "#cae8ff" },
  modeStandard: { bg: "#b08800", fg: "#fff3b0" },
  modeSocratic: { bg: "#6e40c9", fg: "#e2ccff" },
} as const;
