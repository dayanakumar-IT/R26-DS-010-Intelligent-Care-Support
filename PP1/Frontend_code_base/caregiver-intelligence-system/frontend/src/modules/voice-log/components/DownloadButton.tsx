import { Download } from 'lucide-react'
import { Button } from '../../../shared/components/Button'

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function DownloadButton({
  filename,
  getContent,
  label,
  variant = 'secondary',
}: {
  filename: string
  label: string
  getContent: () => { mime: string; text: string }
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return (
    <Button
      className="vl-btn"
      variant={variant}
      size="sm"
      onClick={() => {
        const { mime, text } = getContent()
        downloadBlob(filename, new Blob([text], { type: mime }))
      }}
    >
      <span className="inline-flex items-center gap-2">
        <Download size={16} />
        {label}
      </span>
    </Button>
  )
}

