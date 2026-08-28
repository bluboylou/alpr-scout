import type { AppImageAsset } from '@evenrealities/even_hub_sdk'
import type { NearbyCamera } from './deflock-data'
import {
  buildDeflockNodeUrl,
  buildOsmEditorUrl,
  buildOsmNodeUrl,
  DEFLOCK_REPORT_GUIDE_URL,
  formatOsmTags,
  type ReportDraft,
} from './report'

function root(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#phone-status')
}

function clearRoot(): HTMLElement | null {
  const element = root()
  element?.replaceChildren()
  return element
}

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement('p')
  element.textContent = text
  return element
}

function link(label: string, url: string): HTMLAnchorElement {
  const element = document.createElement('a')
  element.textContent = label
  element.href = url
  element.target = '_blank'
  element.rel = 'noopener noreferrer'
  element.style.display = 'block'
  element.style.margin = '0.75rem 0'
  element.style.color = '#8ff0ac'
  return element
}

export function showPhoneMessage(message: string): void {
  const element = clearRoot()
  element?.append(paragraph(message))
}

export function showNearbyCameraOnPhone(camera: NearbyCamera): void {
  const element = clearRoot()
  if (!element) return

  const heading = document.createElement('h1')
  heading.textContent = camera.tags.manufacturer || 'Mapped ALPR camera'

  if (camera.isDemo) {
    element.append(
      heading,
      paragraph('Simulator demo record - no external camera record exists.'),
      paragraph(`${camera.latitude.toFixed(6)}, ${camera.longitude.toFixed(6)}`),
    )
    return
  }

  element.append(
    heading,
    paragraph(`${camera.latitude.toFixed(6)}, ${camera.longitude.toFixed(6)}`),
    link('Open in the DeFlock app', buildDeflockNodeUrl(camera.id)),
    link('View on OpenStreetMap', buildOsmNodeUrl(camera.id)),
  )
}

function photoSource(photo: AppImageAsset): string {
  return photo.base64.startsWith('data:')
    ? photo.base64
    : `data:${photo.mimeType};base64,${photo.base64}`
}

export function showReportHandoffOnPhone(
  draft: ReportDraft,
  photo?: AppImageAsset,
): void {
  const element = clearRoot()
  if (!element) return

  const heading = document.createElement('h1')
  heading.textContent = draft.isDemo ? 'Demo camera report' : 'Camera report ready'

  element.append(
    heading,
    ...(draft.isDemo
      ? [paragraph('Simulator test data only. Do not submit this report.')]
      : []),
    paragraph(
      `${draft.profile.name}, facing ${draft.direction}°, at ${draft.location.latitude.toFixed(6)}, ${draft.location.longitude.toFixed(6)}.`,
    ),
  )

  if (photo) {
    const image = document.createElement('img')
    image.src = photoSource(photo)
    image.alt = 'Captured camera reference'
    image.style.width = '100%'
    image.style.maxHeight = '18rem'
    image.style.objectFit = 'contain'
    element.append(image)
  }

  const tags = document.createElement('pre')
  tags.textContent = formatOsmTags(draft.tags)
  tags.style.whiteSpace = 'pre-wrap'
  tags.style.textAlign = 'left'
  element.append(tags)

  const copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.textContent = 'Copy DeFlock-compatible OSM tags'
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(formatOsmTags(draft.tags))
      copyButton.textContent = 'Tags copied'
    } catch {
      copyButton.textContent = 'Copy unavailable - select the tags above'
    }
  })

  element.append(
    copyButton,
    ...(draft.isDemo
      ? []
      : [
          link('Open the DeFlock reporting guide', DEFLOCK_REPORT_GUIDE_URL),
          link('Open OSM editor at this location', buildOsmEditorUrl(draft.location)),
        ]),
    paragraph(
      'Review the point and tags before saving. A photo is a session-only reference and is not uploaded automatically.',
    ),
  )
}
