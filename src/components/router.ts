import {Component, html, RenderResult} from 'lupos.html'
import {computed, DOMEvents} from 'lupos'
import {getPathMatcher} from './router-helpers/path-match'
import {Popup} from './popup'
import {PathMatcher} from './router-helpers/path-matcher'


export interface RouterEvents {

	/** After push or replace current state, note updating are not completed right now. */
	'change': (type: RouterChangeType, newState: RouterHistoryState, oldState: RouterHistoryState | null) => void
}

/** Current history state. */
export interface RouterHistoryState {

	/** An unique auto increment id. */
	index: number

	/** 
	 * State path and hash, must start with `/`, and may have hash in the tail.
	 * It's the path after uri component decoded.
	 */
	path: string

	/** The prefix separate from url path. */
	prefix: string
}


/** Whether router has redirected or replaced. */
type RouterChangeType = 'redirect' | 'goto'

/** To handle each route. */
type RouteHandler = (params: Record<string | number, string>) => RenderResult

/** Routes list or object. */
export type Routes = Record<string, RouteHandler> | {path: string | RegExp, handler: RouteHandler}[]

/** Parsed path and prefix. */
export type PrefixedPath = {prefix: string, path: string}


/** 
 * `<Router>` serves as the top-level container for all routable content,
 * rendering things based on the current path.
 * 
 * You may handle each route manually:
 *
 * ```ts
 *   this.route('/user:id', ({id}) => {
 *     return html`User Id: ${id}`
 *   })
 * 
 *   this.route('/users*', ({0: user}) => {
 *     return html`User Id: ${id}`
 *   })
 * ```
 * 
 * Or defines routes if you want to interpolate
 * links and do custom redirecting.
 */
export class Router<E = {}> extends Component<RouterEvents & E> {

	/** `Router.fromClosest` can locate original component when within popup content. */
	static override fromClosest<C extends {new(...args: any): any}>(this: C, element: Element, searchDepth: number = 50): InstanceType<C> | null {
		let parent: Element | null = element
		let depth = 0

		while (parent) {
			let com = Component.from(parent) as Component

			if (com && com instanceof Router) {
				return com as InstanceType<C>
			}
			else if (com && com instanceof Popup) {
				parent = com.getTriggerElement()
			}
			else {
				parent = parent.parentElement
			}

			if (depth >= searchDepth) {
				break
			}
		}

		return null
	}

	/** Match a path with a target route path, and get match parameters. */
	static match(path: string, routePath: string | RegExp): Record<string | number, string> | null {
		let matcher = getPathMatcher(routePath)
		return matcher.match(path)
	}

	/** Test whether a path match specified route path. */
	static test(path: string, routePath: string | RegExp): boolean {
		let matcher = getPathMatcher(routePath)
		return matcher.test(path)
	}

	/** 
	 * Whether cache content rendering, and quickly restore after navigate back.
	 * Default value is `false`.
	 */
	cache: boolean = true

	/** Prefix separated from uri path. */
	prefix: string = ''

	/** 
	 * Current path, unprefixed, no matter normal path or popup path.
	 * If work as a sub router, it accepts rest path of outer router processed.
	 * If `path` is not get initialized, it will be initialized by pathname part of current uri.
	 */
	path: string = ''

	/** 
	 * If can render popup content, it's the popup path to match popup routes.
	 * Note `#` get excluded.
	 */
	popupPath: string = ''

	/** 
	 * If in hash mode, will apply hash instead of applying pathname.
	 * Use this if there is only a single page.
	 */
	hashMode: boolean = false

	/** 
	 * If specified, will interpolate links and do custom redirecting.
	 * You may define a `*` path of route to capture 404 and prevent redirecting.
	 * You may leave it and choose to override `render`.
	 */
	routes: Record<string, RouteHandler> | {path: string | RegExp, handler: RouteHandler}[] | null = null

	/** 
	 * If specified, will match hash and render popup contents after normal contents.
	 * You may leave it and choose to override `renderPopup`.
	 */
	popupRoutes: Record<string, RouteHandler> | {path: string | RegExp, handler: RouteHandler}[] | null = null

	/** Current history state. */
	protected state!: RouterHistoryState

	/** To indicate latest state index. */
	protected latestStateIndex: number = 0

	/** 
	 * Use it to parse uri path to prefix and a path and.
	 * If it returns null, means we should reload whole page.
	 */
	protected parsePath(href: string): PrefixedPath | null {
		return {prefix: '', path: href}
	}

	@computed
	protected get normalizedRoutes(): {matcher: PathMatcher, handler: RouteHandler}[] {
		if (!this.routes) {
			return []
		}

		return this.normalizeAnyRoutes(this.routes)
	}

	@computed
	protected get normalizedPopupRoutes(): {matcher: PathMatcher, handler: RouteHandler}[] {
		if (!this.popupRoutes) {
			return []
		}

		return this.normalizeAnyRoutes(this.popupRoutes)
	}

	protected normalizeAnyRoutes(routes: Routes): {matcher: PathMatcher, handler: RouteHandler}[] {
		if (!this.routes) {
			return []
		}

		if (Array.isArray(routes)) {
			return routes.map(r => {
				return {
					matcher: getPathMatcher(r.path),
					handler: r.handler,
				}
			})
		}
		else {
			return Object.entries(routes).map(([path, handler]) => {
				return {
					matcher: getPathMatcher(path),
					handler: handler,
				}
			})
		}
	}

	protected override onConnected() {
		super.onConnected()

		if (!this.path) {
			if (this.hashMode) {
				let parsed = this.parsePath(decodeURIComponent(location.hash.replace(/^#/, '')) || '/') || {prefix: '', path: '/'}
				this.path = parsed.path
				this.prefix = parsed.prefix
			}
			else {
				let parsed = this.parsePath(decodeURIComponent(location.pathname)) || {prefix: '', path: '/'}
				this.path = parsed.path
				this.prefix = parsed.prefix
				this.popupPath = decodeURIComponent(location.hash.replace(/^#/, ''))
			}
		}

		// Replace current state, also normalize current path.
		this.state = {index: 0, path: this.path + (this.popupPath ? '#' + this.popupPath : ''), prefix: this.prefix}
		this.acceptState(this.state, true)

		DOMEvents.on(window, 'popstate', this.onWindowPopState, this)
		DOMEvents.on(window, 'hashchange', this.onWindowHashChange, this)

		if (this.routes) {
			DOMEvents.on(this.el, 'click', this.handleLinkClick, this)
		}
	}

	protected override onWillDisconnect() {
		super.onWillDisconnect()

		DOMEvents.off(window, 'popstate', this.onWindowPopState, this)
		DOMEvents.off(window, 'hashchange', this.onWindowHashChange, this)

		if (this.routes) {
			DOMEvents.off(this.el, 'click', this.handleLinkClick, this)
		}
	}

	protected handleLinkClick(e: MouseEvent) {
		let anchor = (e.target as Element).closest('a')
		if (!anchor) {
			return
		}

		if (anchor.target && anchor.target !== '_self') {
			return
		}

		let href = anchor.getAttribute('href')
		if (!href || !(href.startsWith('/') || href.startsWith('#'))) {
			return
		}
		
		let [path, hash] = href.split('#')
		let prefix = ''

		if (path) {
			let parsed = this.parsePath(path)
			if (parsed === null) {
				return
			}

			path = parsed.path
			prefix = parsed.prefix
		}

		let routes = this.normalizedRoutes
		let routeMatch = path === '' || routes.find(r => r.matcher.test(path))

		// Use current path when hash only
		if (!path) {
			path = this.path
			prefix = this.prefix
		}

		href = prefix + (path === '/' && prefix ? '' : path) + (hash ? '#' + hash : '')

		if (routeMatch) {
			e.preventDefault()
			this.goto(href)
		}
	}

	protected onWindowPopState(e: PopStateEvent) {
		if (!e.state) {
			return
		}

		this.acceptState(e.state, true)
	}

	protected onWindowHashChange() {
		let hash = location.hash.replace(/^#/, '')

		if (this.hashMode) {
			let path = hash || '/'
			if (!path.startsWith('/')) {
				return
			}

			// Handle custom modifying hash.
			if (path !== this.path) {
				this.redirectTo(path)
			}
		}
		else {
			this.redirectTo('#' + hash)
		}
	}

	/** Goto a new path and update render result, add a history state. */
	goto(href: string): boolean {
		return this.navigateTo(href, false)
	}

	/** Redirect to a new path and update render result, replace current history state. */
	redirectTo(href: string): boolean {
		return this.navigateTo(href, true)
	}

	/** `isRedirection` determines redirect or go to a href. */
	navigateTo(href: string, isRedirection: boolean): boolean {
		let [path, hash] = href.split('#')
		if (!path && !hash) {
			return false
		}

		let state: RouterHistoryState

		if (path === '') {
			if (hash === this.popupPath) {
				return false
			}

			state = {
				index: this.state.index + 1,
				prefix: '',
				path: '#' + hash
			}
		}
		else {
			let parsed = this.parsePath(path)
			if (!parsed) {
				return false
			}

			if (parsed.path === this.path
				&& parsed.prefix === this.popupPath
				&& hash === this.popupPath
			) {
				return false
			}
			
			state = {
				index: this.state.index + 1,
				prefix: parsed.prefix,
				path: parsed.path + (hash ? '#' + hash : ''),
			}
		}

		this.acceptState(state, isRedirection)
		return true
	}

	protected acceptState(this: Router, state: RouterHistoryState, isRedirecting: boolean) {
		let oldState = this.state
		let uri = this.getHistoryURI(state)
		
		this.prefix = state.prefix;
		[this.path, this.popupPath] = state.path.split('#')
		this.state = state

		if (isRedirecting) {
			history.replaceState(state, '', uri)
		}
		else {
			history.pushState(state, '', uri)
		}

		this.onRouterChange(isRedirecting ? 'redirect' : 'goto', this.state, oldState)
	}

	protected getHistoryURI(state: RouterHistoryState) {
		let uri = state.prefix + (state.path === '/' && state.prefix ? '' : state.path)

		if (this.hashMode) {
			uri = location.pathname + location.search + '#' + state
		}

		return uri
	}

	protected onRouterChange(this: Router, type: RouterChangeType, newState: RouterHistoryState, oldState: RouterHistoryState | null) {
		this.fire('change', type, newState, oldState)
	}

	/** Check whether can go back. */
	canGoBack() {
		return this.state && this.state.index > 0
	}

	/** Check whether can go back. */
	canGoForward() {
		return this.state && this.state.index < this.latestStateIndex
	}

	/** Test whether current path match specified route path. */
	test(routePath: string | RegExp): boolean {
		let matcher = getPathMatcher(routePath)
		return matcher.test(this.path)
	}

	/** Test whether current path match specified popup route path. */
	testPopup(popupRoutePath: string | RegExp): boolean {
		let matcher = getPathMatcher(popupRoutePath)
		return matcher.test(this.popupPath)
	}

	/** 
	 * Render content if route path match.
	 * `renderFn` receives:
	 *  - `{id: '12345'}` for router paths like `/user/:id`,
	 *  - `{0: '12345'}` for router wild match like `/user/*`,
	 *  - `{0: '12345'}` for router regexps like `/\/user\/(\d+)/`,
	 *  - `{id: '12345'}` for router regexps like `/\/user\/(?<id>\d+)/`.
	 */
	route(routePath: string | RegExp, renderFn: RouteHandler): RenderResult {
		let matcher = getPathMatcher(routePath)
		let params = matcher.match(this.path)!

		return renderFn(params)
	}

	/** 
	 * Render content if route path match.
	 * `renderFn` receives:
	 *  - `{id: '12345'}` for router paths like `user=:id`,
	 *  - `{0: '12345'}` for router wild match like `user=*`,
	 *  - `{0: '12345'}` for router regexps like `/user=(\d+)/`,
	 *  - `{id: '12345'}` for router regexps like `/user=(?<id>\d+)/`.
	 */
	routePopup(popupRoutePath: string | RegExp, renderFn: RouteHandler): RenderResult {
		let matcher = getPathMatcher(popupRoutePath)
		let params = matcher.match(this.popupPath)!

		return renderFn(params)
	}

	protected override render(): RenderResult {
		return html`
			${this.renderRoutes()}
			${this.renderPopupRoutes()}
		`
	}

	protected renderRoutes(): RenderResult {
		if (!this.routes) {
			return null
		}

		let route = this.normalizedRoutes.find(r => r.matcher.test(this.path))
		if (!route) {
			return null
		}

		let params = route.matcher.match(this.path)!

		if (this.cache) {
			return html`
				<lu:keyed ${route.matcher.identifier} cache>
					${route.handler(params)}
				</lu:keyed>
			`
		}
		else {
			return route.handler(params)
		}
	}

	protected renderPopupRoutes(): RenderResult {
		if (!this.popupRoutes) {
			return null
		}

		let route = this.normalizedPopupRoutes.find(r => r.matcher.test(this.popupPath))
		if (!route) {
			return null
		}

		let params = route.matcher.match(this.popupPath)!

		if (this.cache) {
			return html`
				<lu:keyed ${route.matcher.identifier} cache>
					${route.handler(params)}
				</lu:keyed>
			`
		}
		else {
			return route.handler(params)
		}
	}
}
