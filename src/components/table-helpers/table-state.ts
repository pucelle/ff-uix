import {webStorage} from 'ff-kit'
import type {Table} from '../table'
import {Store} from '../../data/store'
import {RemoteStore} from '../../data/remote-store'


/** Can get from a table, the result can be used to restore table state. */
export interface TableStateOptions {

	/** Caches filter. Default value is `false`. */
	filter?: boolean

	/** Caches order column and direction. Default value is `false`. */
	order?: boolean

	/** Caches start index. Default value is `false`. */
	visibleIndex?: boolean

	/** 
	 * Customized data cache additional data object.
	 * Which can be restored for customize usage.
	 */
	customized?: object

	/** 
	 * If specifies as `true`, will cache state into local storage.
	 * Only available when all the properties can be serialized to JSON.
	 */
	toStorage?: boolean
}


/** Can get from a table, the result can be used to restore table state. */
interface TableState {
	filter?: ((item: any) => boolean) | string | null
	visibleIndex?: number
	orderName?: string | null
	orderDirection?: 'asc' | 'desc' | null
	customized?: object | undefined
}


const DefaultTableStateOptions: TableStateOptions = {
	filter: false,
	order: false,
	visibleIndex: false,
	customized: {},
}


/** 
 * Can cache table ordering and filtering state,
 * and restore them later.
 */
export class TableStateCacher {

	private readonly storagePrefix: string = 'table_state_'
	private readonly table: Table
	private readonly cacheMap: Map<string, TableState> = new Map()

	constructor(table: Table) {
		this.table = table
	}

	/** Checks whether caches table state exists. */
	has(name: string = 'default'): boolean {
		return this.cacheMap.has(name)
			|| webStorage.has(this.storagePrefix + name)
	}

	/** 
	 * Cache current table state.
	 * Can specify multiple `name` for 
	 */
	cache(name: string, options: TableStateOptions) {
		let state = this.getState(options)
		this.cacheMap.set(name, state)

		if (options.toStorage) {
			this.save(name, state)
		}
	}

	protected save(name: string, state: TableState) {
		try {
			webStorage.set(this.storagePrefix + name, state)
		}
		catch (err) {
			console.error(`Can't serialize table cache data!`, state, err)
		}
	}

	private getState(options: TableStateOptions): TableState {
		let table = this.table
		let store = this.table.store as Store | RemoteStore
		let state: TableState = {}

		options = {...DefaultTableStateOptions, ...options}

		if (options.filter) {
			state.filter = store.filter
		}

		if (options.order) {
			state.orderName = table.orderName
			state.orderDirection = table.orderDirection
		}

		if (options.visibleIndex) {
			state.visibleIndex = table.getStartVisibleIndex(0.33)
		}

		state.customized = options.customized

		return state
	}

	/** 
	 * Restore table state by it's cached name.
	 * Returns customized data with `{}` as default value if restored successfully,
	 * Returns `undefined` if have no cache to restore.
	 * Will clear the cache after restored.
	 */
	restore(name: string): object | undefined {
		let table = this.table
		let store = this.table.store as Store | RemoteStore

		let state = this.cacheMap.get(name)
		if (!state) {
			state = webStorage.get(this.storagePrefix + name)

			if (!state) {
				return undefined
			}
		}

		if (state.filter !== undefined) {
			store.filter = state.filter
		}

		if (state.orderName !== undefined && state.orderDirection !== undefined) {
			table.orderName = state.orderName
			table.orderDirection = state.orderDirection
		}

		if (state.visibleIndex !== undefined) {
			table.setStartVisibleIndex(state.visibleIndex)
		}

		this.clear(name)

		return state.customized
	}

	/** Clear specified named of caches, include caches in storage. */
	clear(name: string) {
		this.cacheMap.delete(name)
		webStorage.delete(this.storagePrefix + name)
	}
}