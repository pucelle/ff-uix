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
	 * State path and hash, normally starts with `/`.
	 * It's the path after uri component decoded.
	 */
	href: string
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
	 * Current path, no matter normal path or popup path.
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
				this.path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/'
			}
			else {
				this.path = decodeURIComponent(location.pathname) || '/'
				this.popupPath = decodeURIComponent(location.hash.replace(/^#/, ''))
			}
		}

		this.state = {index: 0, href: this.path}
		this.replaceHistoryState(this.state)

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

		if (anchor.target !== '_self') {
			return
		}

		let href = anchor.href
		if (!href.startsWith('/') || !href.startsWith('#')) {
			return
		}
		
		let [path] = href.split('#')
		let routes = this.normalizedRoutes
		let routeMatch = path === '' || routes.find(r => r.matcher.test(path))

		if (routeMatch) {
			e.preventDefault()
			this.goto(href)
		}
	}

	protected onWindowPopState(e: PopStateEvent) {
		if (!e.state) {
			return
		}

		this.handleRedirectToState(e.state)
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
	goto(this: Router, href: string) {
		let [path, hash] = href.split('#')

		if (path === '') {
			path = this.path
		}

		if (path !== this.path || hash !== this.popupPath) {
			let newIndex = this.latestStateIndex = this.state.index + 1
			let state: RouterHistoryState = {index: newIndex, href}
			this.handleGotoState(state)
		}
	}

	protected handleGotoState(this: Router, state: RouterHistoryState) {
		let oldState = this.state;

		[this.path, this.popupPath] = state.href.split('#')
		this.state = state
		this.pushHistoryState(state)

		this.onRouterChange('goto', this.state, oldState)
	}

	protected pushHistoryState(state: RouterHistoryState) {
		let uri = this.getHistoryURI(state.href)
		history.pushState(state, '', uri)
	}

	protected getHistoryURI(path: string) {
		let uri = path

		if (this.hashMode) {
			uri = location.pathname + location.search + '#' + path
		}

		return uri
	}

	/** Redirect to a new path and update render result, replace current history state. */
	redirectTo(href: string) {
		let [path, hash] = href.split('#')

		if (path === '') {
			path = this.path
		}

		if (path !== this.path || hash !== this.popupPath) {
			let newIndex = this.latestStateIndex = this.state.index
			let state: RouterHistoryState = {index: newIndex, href}
			this.handleRedirectToState(state)
		}
	}

	protected handleRedirectToState(this: Router, state: RouterHistoryState) {
		let oldState = this.state

		this.path = state.href
		this.state = state
		this.replaceHistoryState(state)

		this.onRouterChange('redirect', this.state, oldState)
	}

	protected replaceHistoryState(state: RouterHistoryState) {
		let uri = this.getHistoryURI(state.href)
		history.replaceState(state, '', uri)
	}

	protected onRouterChange(this: Router, type: RouterChangeType, newState: RouterHistoryState, oldState: RouterHistoryState | null) {
		this.fire('change', type, newState, oldState)
	}

	/** `isRedirection` determines redirect or go to a href.  */
	navigateTo(href: string, isRedirection: boolean) {
		if (isRedirection) {
			this.redirectTo(href)
		}
		else {
			this.goto(href)
		}
	}

	/** 
	 * Use this to push a history state separately without affecting rendering.
	 * So later can navigate back to this path.
	 */
	pushHistoryOnly(href: string) {
		let newIndex = this.latestStateIndex = this.state.index + 1
		let state: RouterHistoryState = {index: newIndex, href}
		this.pushHistoryState(state)
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
		return route.handler(params)
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
		return route.handler(params)
	}
}
