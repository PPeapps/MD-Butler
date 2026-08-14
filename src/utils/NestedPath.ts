type NestedObject = Record<string, unknown>;

function isObject(value: unknown): value is NestedObject {
	return typeof value === "object" && value !== null;
}

export function getNested(obj: NestedObject, path: string): unknown {
	if (!path.includes(".")) return obj[path];
	const keys = path.split(".");
	let o: unknown = obj;
	for (const k of keys) {
		if (o == null) return undefined;
		if (!isObject(o)) return undefined;
		o = o[k];
	}
	return o;
}

export function setNested(obj: NestedObject, path: string, value: unknown): void {
	if (!path.includes(".")) {
		obj[path] = value;
		return;
	}
	const keys = path.split(".");
	let o: NestedObject = obj;
	const last = keys.pop()!;
	for (const key of keys) {
		const current = o[key];
		if (!isObject(current)) {
			o[key] = {};
		}
		o = o[key] as NestedObject;
	}
	o[last] = value;
}

export function deleteNested(obj: NestedObject, path: string): void {
	if (!path.includes(".")) {
		delete obj[path];
		return;
	}
	const keys = path.split(".");
	const last = keys.pop()!;
	let o: unknown = obj;
	for (const key of keys) {
		if (o == null) return;
		if (!isObject(o)) return;
		o = o[key];
	}
	if (isObject(o)) delete o[last];
}

export function hasNested(obj: NestedObject, path: string): boolean {
	return getNested(obj, path) !== undefined;
}

export function isEmptyValue(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value === "string") return value.trim() === "";
	if (Array.isArray(value)) return value.length === 0;
	if (isObject(value)) return Object.keys(value).length === 0;
	return false;
}
