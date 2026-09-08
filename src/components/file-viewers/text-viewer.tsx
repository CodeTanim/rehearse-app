'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, ClipboardCopy, Download, LoaderCircle, Moon, Sun } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'

interface TextViewerProps {
  fileUrl: string
  fileName: string
  mimeType: string
}

const getLanguageFromFileName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'ps1': 'powershell',
    'sql': 'sql',
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'cfg': 'ini',
    'conf': 'ini',
    'md': 'markdown',
    'markdown': 'markdown',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'r': 'r',
    'matlab': 'matlab',
    'm': 'matlab',
    'tex': 'latex',
    'vue': 'vue',
    'svelte': 'svelte',
    'dart': 'dart',
    'clj': 'clojure',
    'cljs': 'clojure',
    'hs': 'haskell',
    'elm': 'elm',
    'erl': 'erlang',
    'ex': 'elixir',
    'exs': 'elixir',
    'lua': 'lua',
    'perl': 'perl',
    'pl': 'perl',
    'vim': 'vim',
  }
  
  return languageMap[extension || ''] || 'text'
}

const getLanguageDisplayName = (language: string): string => {
  const displayNames: Record<string, string> = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'jsx': 'React JSX',
    'tsx': 'React TSX',
    'python': 'Python',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'csharp': 'C#',
    'php': 'PHP',
    'ruby': 'Ruby',
    'go': 'Go',
    'rust': 'Rust',
    'swift': 'Swift',
    'kotlin': 'Kotlin',
    'scala': 'Scala',
    'bash': 'Shell Script',
    'powershell': 'PowerShell',
    'sql': 'SQL',
    'html': 'HTML',
    'xml': 'XML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'less': 'Less',
    'json': 'JSON',
    'yaml': 'YAML',
    'toml': 'TOML',
    'ini': 'INI Config',
    'markdown': 'Markdown',
    'dockerfile': 'Dockerfile',
    'makefile': 'Makefile',
    'latex': 'LaTeX',
    'vue': 'Vue.js',
    'svelte': 'Svelte',
    'dart': 'Dart',
    'clojure': 'Clojure',
    'haskell': 'Haskell',
    'elm': 'Elm',
    'erlang': 'Erlang',
    'elixir': 'Elixir',
    'lua': 'Lua',
    'perl': 'Perl',
    'vim': 'Vim Script',
    'text': 'Plain Text',
  }
  
  return displayNames[language] || language.charAt(0).toUpperCase() + language.slice(1)
}

type TextLoadState = {
  fileUrl: string
  content: string
  error: string | null
  loading: boolean
}

export function TextViewer({ fileUrl, fileName }: TextViewerProps) {
  const [loadState, setLoadState] = useState<TextLoadState>({
    fileUrl,
    content: '',
    error: null,
    loading: true,
  })
  const [lineNumbers, setLineNumbers] = useState<boolean>(true)
  const [wordWrap, setWordWrap] = useState<boolean>(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [fontSize, setFontSize] = useState<number>(14)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  
  const language = getLanguageFromFileName(fileName)
  const displayLanguage = getLanguageDisplayName(language)
  const currentLoadState = loadState.fileUrl === fileUrl
    ? loadState
    : { fileUrl, content: '', error: null, loading: true }
  const { content, error, loading } = currentLoadState

  useEffect(() => {
    const abortController = new AbortController()

    async function loadContent() {
      try {
        const response = await fetch(fileUrl, { signal: abortController.signal })
        if (!response.ok) throw new Error('Couldn’t open this file. Download it instead.')

        const text = await response.text()
        if (!abortController.signal.aborted) {
          setLoadState({ fileUrl, content: text, error: null, loading: false })
        }
      } catch (loadError) {
        if (!abortController.signal.aborted) {
          setLoadState({
            fileUrl,
            content: '',
            error: loadError instanceof Error ? loadError.message : 'Couldn’t open this file. Download it instead.',
            loading: false,
          })
        }
      }
    }

    void loadContent()
    return () => abortController.abort()
  }, [fileUrl])

  const downloadAsText = useCallback(() => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [content, fileName])

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopyStatus('copied')
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      setCopyStatus('error')
    }
  }, [content])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        <div className="text-center">
          <LoaderCircle className="mx-auto mb-4 size-8 animate-spin text-accent" aria-hidden="true" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
          </div>
          <p className="text-destructive font-medium">{error}</p>
        </div>
      </div>
    )
  }

  const lineCount = content.split('\n').length
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length

  return (
    <div className="flex flex-col h-full" aria-label={`Text viewer for ${fileName}`}>
      {/* Text File Controls */}
      <div className="flex flex-col gap-3 border-b-[3px] border-foreground bg-muted p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {displayLanguage} · {lineCount} lines · {wordCount} words
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* View Options */}
          <div className="flex items-center gap-2" role="group" aria-label="Text display options">
            <Button
              type="button"
              variant={lineNumbers ? "default" : "outline"}
              size="sm"
              onClick={() => setLineNumbers(!lineNumbers)}
              aria-label="Show line numbers"
              aria-pressed={lineNumbers}
            >
              #
            </Button>
            <Button
              type="button"
              variant={wordWrap ? "default" : "outline"}
              size="sm"
              onClick={() => setWordWrap(!wordWrap)}
              aria-pressed={wordWrap}
            >
              Wrap
            </Button>
            <Button
              type="button"
              variant={theme === 'dark' ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} code theme`}
              aria-pressed={theme === 'dark'}
            >
              {theme === 'light' ? (
                <Moon aria-hidden="true" className="size-4" />
              ) : (
                <Sun aria-hidden="true" className="size-4" />
              )}
            </Button>
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-2 sm:border-l-2 sm:border-foreground/30 sm:pl-3" role="group" aria-label="Code font size">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setFontSize(prev => Math.max(prev - 2, 10))}
              disabled={fontSize <= 10}
              aria-label="Decrease font size"
            >
              A-
            </Button>
            <span className="text-sm text-muted-foreground min-w-[2rem] text-center">
              {fontSize}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setFontSize(prev => Math.min(prev + 2, 24))}
              disabled={fontSize >= 24}
              aria-label="Increase font size"
            >
              A+
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:border-l-2 sm:border-foreground/30 sm:pl-3">
            <Button type="button" variant="outline" size="sm" onClick={copyToClipboard}>
              <ClipboardCopy aria-hidden="true" className="size-4" />
              Copy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadAsText}>
              <Download aria-hidden="true" className="size-4" />
              Download
            </Button>
            <span className="text-xs font-bold text-muted-foreground" role="status" aria-live="polite">
              {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Couldn’t copy' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Text Content */}
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={theme === 'light' ? oneLight : oneDark}
          showLineNumbers={lineNumbers}
          wrapLines={wordWrap}
          wrapLongLines={wordWrap}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: `${fontSize}px`,
            lineHeight: 1.5,
            minHeight: '100%',
          }}
          codeTagProps={{
            style: {
              fontSize: `${fontSize}px`,
              lineHeight: 1.5,
            }
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
