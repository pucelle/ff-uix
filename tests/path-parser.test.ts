import {describe, expect, it, vi} from 'vitest'
import {HrefParser} from '../src/components/router-helpers/path-parser'


describe('HrefParser', () => {
	function createParser() {
		return new HrefParser(path => {
			if (!path.startsWith('/app')) {
				return null
			}

			return {
				prefix: '/app',
				path: path.slice('/app'.length) || '/',
			}
		})
	}

	it('parses prefixed paths, search parameters, and hashes', () => {
		expect(createParser().parsePrefixed('/app/users?q=active#editor')).toEqual({
			prefix: '/app',
			path: '/users',
			search: '?q=active',
			hash: 'editor',
		})
	})

	it('rejects paths outside the configured prefix', () => {
		expect(createParser().parsePrefixed('/other/users')).toBeNull()
	})

	it('keeps a hash-only href relative to the current path', () => {
		let parsePath = vi.fn(() => ({prefix: '', path: '/'}))
		let parser = new HrefParser(parsePath)

		expect(parser.parsePrefixed('#editor')).toEqual({
			prefix: '',
			path: '',
			search: '',
			hash: 'editor',
		})
		expect(parsePath).not.toHaveBeenCalled()
	})

	it('builds prefixed and unprefixed hrefs', () => {
		let parser = createParser()
		let parsed = {
			prefix: '/app',
			path: '/users',
			search: '?q=active',
			hash: 'editor',
		}

		expect(parser.buildPrefixed(parsed)).toBe('/app/users?q=active#editor')
		expect(parser.buildUnprefixed(parsed)).toBe('/users?q=active#editor')
		expect(parser.buildPrefixed({...parsed, path: '/', search: '', hash: ''})).toBe('/app')
	})
})
