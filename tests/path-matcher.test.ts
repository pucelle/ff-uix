import {describe, expect, it} from 'vitest'
import {PathMatcher} from '../src/components/router-helpers/path-matcher'


describe('PathMatcher', () => {
	it('matches named parameters', () => {
		let matcher = new PathMatcher('/users/:userId')

		expect(matcher.test('/users/alice-1')).toBe(true)
		expect(matcher.match('/users/alice-1')).toMatchObject({userId: 'alice-1'})
		expect(matcher.match('/projects/alice-1')).toBeNull()
	})

	it('supports custom parameter patterns', () => {
		let matcher = new PathMatcher('/users/:userId{\\d+}')

		expect(matcher.match('/users/123')).toMatchObject({userId: '123'})
		expect(matcher.test('/users/alice')).toBe(false)
	})

	it('captures wildcard segments by numeric key', () => {
		let matcher = new PathMatcher('/files/*')

		expect(matcher.match('/files/images/avatar.png')).toMatchObject({0: 'images/avatar.png'})
	})

	it('escapes literal dots and matches case-insensitively', () => {
		let matcher = new PathMatcher('/files/readme.md')

		expect(matcher.test('/FILES/README.MD')).toBe(true)
		expect(matcher.test('/files/readmeXmd')).toBe(false)
	})
})
