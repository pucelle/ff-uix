import {Component, html, RenderResult} from 'lupos.html'
import {computed, DOMEvents} from 'lupos'
import {getPathMatcher} from './router-helpers/path-match'
import {Popup} from './popup'
import {PathMatcher} from './router-helpers/path-matcher'
import {HrefParsed, HrefParser, PrefixedPath} from './router-helpers/path-parser'


export interface RouterEvents {

	/** After push or replace current state, note updating are not completed right now. */
	'change': (type: RouterChangeType, newState: RouterHistoryState, oldState: RouterHistoryState | null) => void
}

/** Current history state. */
export interface RouterHistoryState extends HrefParsed {

	/** An unique auto increment id. */
	index: number
}


/** Whether router has redirected or replaced. */
type RouterChangeType = 'redirect' | 'goto'

/** To handle each route. */
type RouteHandler = (params: Record<string | number, string>) => RenderResult

/** Routes list or object. */
export type Routes = Record<string, RouteHandler> | {path: string | RegExp, handler: RouteHandler}[]


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
	 * Current path, unprefixed, no hash.
	 * If work as a sub router, it accepts rest path of outer router processed.
	 * If `path` is not get initialized, it will be initialized by pathname part of current uri.
	 */
	path: string = ''

	/** 
	 * If can render popup content, it's the popup path to match popup routes.
	 * Note `#` get excluded, and not limit to must start with `/`.
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
	 * Note `path` parameter should have no `#hash` on the tail.
	 * If it returns null, means we should reload whole page.
	 */
	protected parsePath(path: string): PrefixedPath | null {
		return {prefix: '', path: path}
	}

	/** 
	 * Use it to parse uri path to prefix and a path and.
	 * Note `path` parameter should have no `#hash` on the tail.
	 * If it returns null, means we should reload whole page.
	 */
	@computed
	protected get hrefParser(): HrefParser {
		return new HrefParser(this.parsePath.bind(this))
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
			let parsed: HrefParsed

			if (this.hashMode) {
				parsed = this.hrefParser.parse(decodeURIComponent(location.hash.replace(/^#/, '')) || '/') ?? this.hrefParser.empty()
			}
			else {
				parsed = this.hrefParser.parse(decodeURIComponent(location.pathname + location.hash)) ?? this.hrefParser.empty()
			}

			this.path = parsed.path
			this.prefix = parsed.prefix
			this.popupPath = parsed.hash
		}

		// Replace current state, also normalize current path.
		this.state = {
			index: 0,
			prefix: this.prefix,
			path: this.path,
			hash: this.popupPath,
		}

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
		
		let parsed = this.hrefParser.parse(href)
		if (!parsed) {
			return
		}

		let routes = this.normalizedRoutes
		let routeMatch = parsed.path === '' || routes.find(r => r.matcher.test(parsed.path))

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
			this.redirectTo(path)
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
		if (!href) {
			return false
		}

		let parsed = this.hrefParser.parse(href)
		if (!parsed) {
			return false
		}

		let state: RouterHistoryState

		if (parsed.path === '') {
			if (parsed.hash === this.popupPath) {
				return false
			}

			state = {
				index: this.state.index + (isRedirection ? 0 : 1),
				prefix: this.prefix,
				path: this.path,
				hash: parsed.hash,
			}
		}
		else {
			if (parsed.path === this.path
				&& parsed.prefix === this.popupPath
				&& parsed.hash === this.popupPath
			) {
				return false
			}
			
			state = {
				index: this.state.index + (isRedirection ? 0 : 1),
				...parsed,
			}
		}

		this.acceptState(state, isRedirection)
		return true
	}

	protected acceptState(this: Router, state: RouterHistoryState, isRedirecting: boolean) {
		let oldState = this.state
		let uri = this.buildHistoryURI(state)
		
		this.prefix = state.prefix
		this.path = state.path
		this.popupPath = state.hash
		this.state = state

		if (isRedirecting) {
			history.replaceState(state, '', uri)
		}
		else {
			history.pushState(state, '', uri)
		}

		this.onRouterChange(isRedirecting ? 'redirect' : 'goto', this.state, oldState)
	}

	protected buildHistoryURI(state: RouterHistoryState) {
		let uri = this.hrefParser.build(state)

		if (this.hashMode) {
			uri = '#' + state
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

		if (!this.popupPath) {
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
