/** Prefix, path and hash. */
export interface HrefParsed {
	prefix: string
	path: string
	search: string
	hash: string
}

/** Parsed path and prefix. */
export type PrefixedPath = {prefix: string, path: string}


export class HrefParser {

	/** Parse path to prefix and remaining path. */
	private readonly parsePath: (path: string) => PrefixedPath | null

	constructor(parsePath: (path: string) => PrefixedPath | null) {
		this.parsePath = parsePath
	}

	/** Parse to path, search, hash parts. */
	private parseHref(href: string) {
		let match = href.match(/(.+?)(\?.*?)?(#.*)?$/)!

		return {
			path: match[1],
			search: match[2] ?? '',
			hash: match[3] ?? '',
		}
	}

	/** Get an empty parsed. */
	empty(): HrefParsed {
		return {
			prefix: '',
			path: '/',
			search: '',
			hash: '',
		}
	}

	/** 
	 * Parse a href with prefixed.
	 * If href is '', will persist it.
	 */
	parsePrefixed(href: string): HrefParsed | null {
		let {path, search, hash} = this.parseHref(href)
		if (!path) {
			return {
				prefix: '',
				path: '',
				search: '',
				hash,
			}
		}

		let parsed = this.parsePath(path)
		if (!parsed) {
			return null
		}

		return {
			...parsed,
			search: search,
			hash: hash,
		}
	}

	/** 
	 * Parse a href without prefixed.
	 * If href is '', will persist it.
	 */
	parseUnprefixed(href: string): HrefParsed {
		let {path, search, hash} = this.parseHref(href)

		return {
			prefix: '',
			path,
			search,
			hash,
		}
	}

	/** Build full href with prefix. */
	buildPrefixed(parsed: HrefParsed): string {
		return parsed.prefix
			+ (parsed.path === '/' && parsed.prefix ? '' : parsed.path)
			+ parsed.search
			+ (parsed.hash ? '#' + parsed.hash : '')
	}

	/** Build a path ignores prefix. */
	buildUnprefixed(parsed: HrefParsed): string {
		return parsed.path
			+ parsed.search
			+ (parsed.hash ? '#' + parsed.hash : '')
	}
}
