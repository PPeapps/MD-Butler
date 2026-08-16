/**
 * Centralized date formatting using the configured moment.js format string.
 */
import { moment } from "obsidian";

/**
 * Minimal structural type for the moment instances used by the plugin.
 * Deliberately decoupled from moment's own type declarations so the type
 * checker never has to resolve them (keeps `no-unsafe-*` rules happy even
 * when moment types are unavailable in the linting environment).
 */
export type MomentLike = {
	isValid(): boolean;
	format(format?: string): string;
	add(amount: number, unit: string): MomentLike;
};

export const momentFn = moment as unknown as {
	(): MomentLike;
	(value?: unknown): MomentLike;
};

export function now(format: string): string {
	return momentFn().format(format);
}
