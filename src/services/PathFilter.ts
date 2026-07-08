/**
 * Path filter supporting include and exclude modes.
 * exclude mode: skip files in excludedFolders.
 * include mode: skip files NOT in includedFolders.
 * All checks apply recursively to subfolders.
 * Comparison is case-insensitive and tolerates trailing slashes.
 */
import { FilterMode } from "../settings/settings";

export class PathFilter {
	static isExcluded(
		filePath: string,
		excludedFolders: string[],
		filterMode?: FilterMode,
		includedFolders?: string[]
	): boolean {
		const match = (folder: string, path: string): boolean => {
			const f = folder.replace(/\/+$/, "").toLowerCase();
			const p = path.toLowerCase();
			return p === f || p.startsWith(f + "/");
		};

		if (filterMode === "include") {
			if (!includedFolders || includedFolders.length === 0)
				return true;
			if (includedFolders.includes("*")) return false;
			return !includedFolders.some((folder) =>
				match(folder, filePath)
			);
		}
		return excludedFolders.some((folder) => match(folder, filePath));
	}
}
