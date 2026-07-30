export type AppTheme = "default" | "sepia" | "oled" | "cream" | "nord";
export type FontFamily = "sans" | "serif" | "mono";
export type FontSize = "sm" | "base" | "lg";
export type LineHeight = "normal" | "relaxed" | "loose";

export type AudioAttachment = {
  id: string;
  url: string;
  blob?: Blob;
  storagePath?: string;
  synced?: boolean;
  durationSeconds: number;
  createdAt: string;
};

export type WritingStats = {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  readingTimeMinutes: number;
  gradeLevel: string;
};

export type AppLockConfig = {
  enabled: boolean;
  hashedPin: string;
  autoLockMinutes: number;
};
