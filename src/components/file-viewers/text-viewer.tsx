'use client'

import { useState, useEffect, useCallback } from 'react'
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

export function TextViewer({ fileUrl, fileName, mimeType }: TextViewerProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lineNumbers, setLineNumbers] = useState<boolean>(true)
  const [wordWrap, setWordWrap] = useState<boolean>(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [fontSize, setFontSize] = useState<number>(14)
  
  const language = getLanguageFromFileName(fileName)
  const displayLanguage = getLanguageDisplayName(language)

  const fetchContent = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(fileUrl)
      
      if (!response.ok) {
        throw new Error('Failed to fetch file content')
      }
      
      const text = await response.text()
      setContent(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }, [fileUrl])

  useEffect(() => {
    fetchContent()
  }, [fetchContent])

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
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }, [content])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading file content...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-muted-foreground text-sm mt-1">Please try downloading the file instead</p>
        </div>
      </div>
    )
  }

  const lineCount = content.split('\n').length
  const characterCount = content.length
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length

  return (
    <div className="flex flex-col h-full">
      {/* Text File Controls */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center space-x-4">
          <h3 className="font-medium text-foreground truncate max-w-xs">{fileName}</h3>
          <span className="text-sm text-muted-foreground">{displayLanguage}</span>
          <span className="text-xs text-muted-foreground">
            {lineCount} lines • {wordCount} words • {characterCount} chars
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* View Options */}
          <div className="flex items-center space-x-1">
            <Button
              variant={lineNumbers ? "default" : "outline"}
              size="sm"
              onClick={() => setLineNumbers(!lineNumbers)}
            >
              #
            </Button>
            <Button
              variant={wordWrap ? "default" : "outline"}
              size="sm"
              onClick={() => setWordWrap(!wordWrap)}
            >
              Wrap
            </Button>
            <Button
              variant={theme === 'dark' ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </Button>
          </div>

          {/* Font Size */}
          <div className="flex items-center space-x-1 border-l border-border pl-2 ml-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize(prev => Math.max(prev - 2, 10))}
              disabled={fontSize <= 10}
            >
              A-
            </Button>
            <span className="text-sm text-muted-foreground min-w-[2rem] text-center">
              {fontSize}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize(prev => Math.min(prev + 2, 24))}
              disabled={fontSize >= 24}
            >
              A+
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-1 border-l border-border pl-2 ml-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={downloadAsText}>
              Download
            </Button>
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