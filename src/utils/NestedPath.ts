export function getNested(obj: Record<string, any>, path: string): any {
	if (!path.includes(".")) return obj[path];
	const keys = path.split(".");
	let o: any = obj;
	for (const k of keys) {
		if (o == null) return undefined;
		o = o[k];
	}
	return o;
}

export function setNested(obj: Record<string, any>, path: string, value: any): void {
	if (!path.includes(".")) {
		obj[path] = value;
		return;
	}
	const keys = path.split(".");
	let o: Record<string, any> = obj;
	const last = keys.pop()!;
	for (const key of keys) {
		if (!(key in o) || typeof o[key] !== "object") o[key] = {};
		o = o[key];
	}
	o[last] = value;
}

export function deleteNested(obj: Record<string, any>, path: string): void {
	if (!path.includes(".")) {
		delete obj[path];
		return;
	}
	const keys = path.split(".");
	const last = keys.pop()!;
	let o: any = obj;
	for (const key of keys) {
		if (o == null) return;
		o = o[key];
	}
	if (o) delete o[last];
}

export function hasNested(obj: Record<string, any>, path: string): boolean {
	return getNested(obj, path) !== undefined;
}
