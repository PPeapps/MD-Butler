/**
 * Centralized date formatting using the configured moment.js format string.
 */
import { moment } from "obsidian";

export function now(format: string): string {
	return moment().format(format);
}
