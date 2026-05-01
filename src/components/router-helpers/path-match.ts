import {PathMatcher} from './path-matcher'


const PathMatcherCache: Map<string, PathMatcher> = /*#__PURE__*/new Map()


/** Build a cacheable path matcher by a route path or regexp. */
export function getPathMatcher(routePath: string): PathMatcher {
	if (typeof routePath !== 'string') {
		return new PathMatcher(routePath)
	}
	else if (PathMatcherCache.has(routePath)) {
		return PathMatcherCache.get(routePath)!
	}
	else {
		let matcher = new PathMatcher(routePath)
		PathMatcherCache.set(routePath, matcher)
		
		return matcher
	}
}
