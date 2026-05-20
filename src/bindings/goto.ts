import {Binding, Part, PartCallbackParameterMask} from 'lupos.html'
import {DOMEvents} from 'lupos'
import {Router} from '../components/router'


/** 
 * A `:goto` binding will goto target location path using router after clicking bound element.
 * Note update parameter `path` is path for closest router, may be path of sub router.
 * 
 * `:goto="routerPath"`
 * `:goto=${routerPath}`
 */
export class goto implements Binding, Part {
	
	protected readonly el: HTMLElement
	protected connected: boolean = false
	protected path: string = ''
	protected asPopupPath: boolean = false

	constructor(el: Element) {
		this.el = el as HTMLElement
	}

	afterConnectCallback(): void {
		if (this.connected) {
			return
		}

		DOMEvents.on(this.el, 'click', this.onClick, this)
	}

    beforeDisconnectCallback(param: PartCallbackParameterMask | 0): Promise<void> | void {
		if ((param & PartCallbackParameterMask.FromOwnStateChange) === 0) {
			return
		}

		DOMEvents.off(this.el, 'click', this.onClick, this)
		this.connected = false
	}

	update(path: string) {
		this.path = path
	}

	protected onClick() {
		Router.current?.goto(this.path)
	}
	
}


/** 
 * A `:redirectTo` binding will redirect to target location path using router after clicking bound element.
 * Note update parameter `path` is path for closest router, may be path of sub router.
 * 
 * `:redirectTo="closestRouterPath"`
 * `:redirectTo=${closestRouterPath}`
 */
export class redirectTo extends goto{

	protected override onClick() {
		Router.current?.redirectTo(this.path)
	}
}

