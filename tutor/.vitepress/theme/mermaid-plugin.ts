import type MarkdownIt from 'markdown-it'
import { renderMermaidSVG } from 'beautiful-mermaid'

const DEFAULT_OPTIONS = {
  bg: 'var(--vp-c-bg)',
  fg: 'var(--vp-c-text-1)',
  accent: 'var(--vp-c-brand-1)',
  line: 'var(--vp-c-border)',
  muted: 'var(--vp-c-text-2)',
  surface: 'var(--vp-c-bg-soft)',
  transparent: true,
  font: 'Inter, system-ui, sans-serif',
}

export function mermaidPlugin(md: MarkdownIt) {
  const defaultFence = md.renderer.rules.fence!

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const lang = token.info.trim().split(/\s+/)[0]

    if (lang === 'mermaid') {
      try {
        const svg = renderMermaidSVG(token.content, DEFAULT_OPTIONS)
        // v-pre prevents Vue from compiling <style> inside the SVG
        return `<div v-pre class="mermaid-diagram">${svg}</div>`
      } catch {
        return `<pre><code>${md.utils.escapeHtml(token.content)}</code></pre>`
      }
    }

    return defaultFence(tokens, idx, options, env, self)
  }
}
