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

function purgeStyleTag(svg: string): string {
  const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  if (!styleMatch) return svg

  const css = styleMatch[1]
  // Strip @import (fails anyway) and scoped selectors (don't work inline),
  // keep only CSS custom property definitions
  const inlineCss = css
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      return trimmed.startsWith('--') && trimmed.includes(':')
    })
    .map(line => line.trim().replace(/;$/, ''))
    .join('; ')

  if (inlineCss) {
    const newSvg = svg.replace(styleMatch[0], '').replace(
      /<svg([^>]*)style="([^"]*)"/,
      `<svg$1style="$2; ${inlineCss}"`
    )
    return newSvg
  }

  return svg.replace(styleMatch[0], '')
}

export function mermaidPlugin(md: MarkdownIt) {
  const defaultFence = md.renderer.rules.fence!

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const lang = token.info.trim().split(/\s+/)[0]

    if (lang === 'mermaid') {
      try {
        const svg = renderMermaidSVG(token.content, DEFAULT_OPTIONS)
        return purgeStyleTag(svg)
      } catch {
        return `<pre><code>${md.utils.escapeHtml(token.content)}</code></pre>`
      }
    }

    return defaultFence(tokens, idx, options, env, self)
  }
}
