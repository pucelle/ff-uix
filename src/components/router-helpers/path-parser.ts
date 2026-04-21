/** Prefix, path and hash. */
export interface HrefParsed {
	prefix: string
	path: string
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

	/** Get an empty parsed. */
	empty(): HrefParsed {
		return {
			prefix: '',
			path: '/',
			hash: '',
		}
	}

	/** 
	 * Parse a href.
	 * If path is '', will persist it.
	 */
	parse(href: string): HrefParsed | null {
		let [path, hash] = href.split('#')
		if (!path) {
			return {
				prefix: '',
				path: '',
				hash,
			}
		}

		let parsed = this.parsePath(path)
		if (!parsed) {
			return null
		}

		return {
			...parsed,
			hash,
		}
	}

	/** Build a href. */
	build(parsed: HrefParsed): string {
		return parsed.prefix
			+ (parsed.path === '/' && parsed.prefix ? '' : parsed.path)
			+ (parsed.hash ? '#' + parsed.hash : '')
	}
}
