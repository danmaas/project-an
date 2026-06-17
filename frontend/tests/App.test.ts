import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'

describe('App', () => {
  it('renders the title and hello-world subtitle', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Player Insights')
    expect(wrapper.text()).toContain('Hello, world.')
  })

  it('renders inside a semantic article element', () => {
    const wrapper = mount(App)
    expect(wrapper.find('article.page').exists()).toBe(true)
  })
})
