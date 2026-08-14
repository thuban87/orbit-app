/**
 * Gated debug logging system for Orbit plugin.
 *
 * Defaults to 'off' — no output until settings wire it in Phase 9.
 * All new code should use Logger instead of raw console.log.
 */

export type LogLevel = "off" | "warn" | "error" | "debug";

export class Logger {
  private static level: LogLevel = "off";

  /** Update the active log level. */
  static setLevel(level: LogLevel): void {
    this.level = level;
  }

  /** Return the current log level. */
  static getLevel(): LogLevel {
    return this.level;
  }

  /** Warnings — missing optional frontmatter, fallback behaviors. */
  static warn(source: string, message: string, ...args: unknown[]): void {
    if (this.level === "warn" || this.level === "debug") {
      console.warn(`[Orbit:${source}]`, message, ...args);
    }
  }

  /** Errors — failed file writes, API failures, parse errors. */
  static error(source: string, message: string, ...args: unknown[]): void {
    if (this.level !== "off") {
      console.error(`[Orbit:${source}]`, message, ...args);
    }
  }

  /** Debug — index scans, file events, status calculations, API payloads. */
  static debug(source: string, message: string, ...args: unknown[]): void {
    if (this.level === "debug") {
      console.log(`[Orbit:${source}]`, message, ...args);
    }
  }
}
