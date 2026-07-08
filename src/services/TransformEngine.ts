import { App, TFile, moment } from "obsidian";
import { EventType } from "../types/Events";
import { getNested } from "../utils/NestedPath";

export interface TransformContext {
	file: TFile;
	eventType: EventType;
	dateFormat: string;
	oldPath?: string;
	oldFolder?: string;
	oldName?: string;
}

export class TransformEngine {
	private lookupCache: Map<string, string> | null = null;
	private lookupDepth = 0;
	private readonly MAX_LOOKUP_DEPTH = 3;

	constructor(private app: App) {}

	resolve(template: string, ctx: TransformContext): string | null {
		const prevCache = this.lookupCache;
		const prevDepth = this.lookupDepth;
		this.lookupCache = new Map();
		this.lookupDepth = 0;
		const result = this.resolveInternal(template, ctx);
		this.lookupCache = prevCache;
		this.lookupDepth = prevDepth;
		return result;
	}

	private resolveInternal(
		template: string,
		ctx: TransformContext
	): string | null {
		const pattern = /\{\{([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g;
		let result = "";
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(template)) !== null) {
			result += template.slice(lastIndex, match.index);
			const expression = match[1]!.trim();
			const resolved = this.resolveWithPipes(expression, ctx);
			if (resolved === null) return null;
			result += resolved;
			lastIndex = match.index + match[0].length;
		}

		result += template.slice(lastIndex);
		return result;
	}

	private resolveWithPipes(
		input: string,
		ctx: TransformContext
	): string | null {
		const parts = input.split("|").map((p) => p.trim());
		if (parts.length === 0) return null;

		let value = this.resolveExpression(parts[0]!, ctx);
		if (value === null) return null;

		for (let i = 1; i < parts.length; i++) {
			const pipeDef = parts[i]!;
			const colonIdx = pipeDef.indexOf(":");
			const pipeName =
				colonIdx >= 0 ? pipeDef.slice(0, colonIdx) : pipeDef;
			const pipeArgs = colonIdx >= 0 ? pipeDef.slice(colonIdx + 1) : "";
			const result = this.applyPipe(pipeName, pipeArgs, value);
			if (result === null) return null;
			value = result;
		}

		return value;
	}

	private applyPipe(
		name: string,
		args: string,
		value: string
	): string | null {
		switch (name) {
			case "upper":
				return value.toUpperCase();
			case "lower":
				return value.toLowerCase();
			case "trim":
				return value.trim();
			case "replace": {
				const commaIdx = args.indexOf(",");
				if (commaIdx < 0) return value;
				const search = args.slice(0, commaIdx);
				const replacement = args.slice(commaIdx + 1);
				return value.split(search).join(replacement);
			}
			case "default":
				return value || args;
			case "substr": {
				const commaIdx = args.indexOf(",");
				if (commaIdx < 0) return value.slice(Number(args));
				const start = Number(args.slice(0, commaIdx));
				const end = Number(args.slice(commaIdx + 1));
				return value.slice(start, end);
			}
			case "date": {
				if (!args) return value;
				const parsed = moment(value);
				return parsed.isValid() ? parsed.format(args) : value;
			}
			default:
				return null;
		}
	}

	private resolveExpression(
		expr: string,
		ctx: TransformContext
	): string | null {
		if (expr.startsWith("date:")) {
			return moment().format(expr.slice(5));
		}

		const relMatch = expr.match(/^now([+-]\d+)([dwMy])$/);
		if (relMatch) {
			const amount = parseInt(relMatch[1]!, 10);
			const unit = relMatch[2] as moment.unitOfTime.DurationConstructor;
			return moment().add(amount, unit).format(ctx.dateFormat);
		}

		switch (expr) {
			case "title":
				return ctx.file.basename;
			case "fileName":
				return ctx.file.name;
			case "fileFolder":
				return ctx.file.parent?.path ?? "";
			case "filePath":
				return ctx.file.path;
			case "oldPath":
				return ctx.oldPath ?? null;
			case "oldFolder":
				return ctx.oldFolder ?? null;
			case "oldName":
				return ctx.oldName ?? null;
		}

		if (expr.startsWith("lookup:")) {
			return this.resolveLookup(expr, ctx);
		}

		if (expr.startsWith("frontmatter:")) {
			const key = expr.slice(12);
			const fm = this.app.metadataCache.getFileCache(ctx.file)?.frontmatter;
			if (!fm) return null;
			let val = getNested(fm, key);
			if (val === undefined) {
				val = this.findNestedCI(fm, key);
			}
			return val !== undefined ? String(val) : null;
		}

		return null;
	}

	private resolveLookup(
		expr: string,
		ctx: TransformContext
	): string | null {
		if (this.lookupDepth >= this.MAX_LOOKUP_DEPTH) return null;
		this.lookupDepth++;

		const rest = expr.slice(7);
		const commaIdx = rest.indexOf(",");
		if (commaIdx < 0) {
			this.lookupDepth--;
			return null;
		}

		const pathExpr = rest.slice(0, commaIdx).trim();
		const fieldExpr = rest.slice(commaIdx + 1).trim();

		const resolvedPath = this.resolveInternal(pathExpr, ctx);
		if (!resolvedPath) {
			this.lookupDepth--;
			return null;
		}
		const resolvedField = this.resolveInternal(fieldExpr, ctx);
		if (!resolvedField) {
			this.lookupDepth--;
			return null;
		}

		const cacheKey = `${resolvedPath}::${resolvedField}`;
		if (this.lookupCache?.has(cacheKey)) {
			const cached = this.lookupCache!.get(cacheKey)!;
			this.lookupDepth--;
			return cached || null;
		}

		const val = this.executeLookup(resolvedPath, resolvedField, ctx);
		this.lookupCache?.set(cacheKey, val ?? "");
		this.lookupDepth--;
		return val;
	}

	private executeLookup(
		path: string,
		field: string,
		ctx: TransformContext
	): string | null {
		const filePath = this.resolveLookupPath(path, ctx);
		if (!filePath) return null;

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return null;

		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm) return null;

		const lowerField = field.toLowerCase();
		let val: unknown = getNested(fm, field);
		if (val === undefined) {
			val = this.findNestedCI(fm, field);
		}
		if (val === undefined || val === null) return null;

		if (Array.isArray(val)) return val.join(", ");
		return String(val);
	}

	private resolveLookupPath(
		path: string,
		ctx: TransformContext
	): string | null {
		if (path.startsWith("/")) {
			const p = path.slice(1);
			if (this.app.vault.getAbstractFileByPath(p) instanceof TFile)
				return p;
			return null;
		}

		if (this.app.vault.getAbstractFileByPath(path) instanceof TFile)
			return path;

		if (path.includes("/") && ctx.file?.parent) {
			const resolved = `${ctx.file.parent.path}/${path}`;
			if (
				this.app.vault.getAbstractFileByPath(resolved) instanceof TFile
			)
				return resolved;
		}

		if (path.startsWith("../") && ctx.file?.parent) {
			const segments = ctx.file.parent.path
				.split("/")
				.filter(Boolean);
			let remaining = path;
			while (remaining.startsWith("../")) {
				if (segments.length === 0) return null;
				segments.pop();
				remaining = remaining.slice(3);
			}
			const resolved = [...segments, remaining].join("/");
			if (
				this.app.vault.getAbstractFileByPath(resolved) instanceof TFile
			)
				return resolved;
		}

		return null;
	}

	private findNestedCI(obj: Record<string, any>, path: string): any {
		const segments = path.split(".");
		let current: any = obj;
		for (const seg of segments) {
			const lower = seg.toLowerCase();
			const found = Object.entries(current).find(
				([k]) => k.toLowerCase() === lower
			);
			if (!found) return undefined;
			current = found[1];
		}
		return current;
	}

}
