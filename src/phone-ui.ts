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

// ── IMU probe phone log ────────────────────────────────────────────────
//
// The IMU probe needs to APPEND one JSON line per sample to the phone
// panel without thrashing the entire DOM (showPhoneMessage replaces the
// whole panel on every call — fine for a single status line, fatal for a
// 10 Hz sample stream).
//
// initPhoneImuLog() clears #phone-status and installs a heading + a
// scrollable <pre> container that will hold every JSON sample line.
// It also adds a "Copy IMU samples" button so the accumulated lines can
// be copied to the clipboard for offline analysis.
//
// appendPhoneLogLine(line) appends a single text line to the <pre>
// container created by initPhoneImuLog().  If the panel was not
// initialised (e.g. the element is missing), it is a safe no-op.
//
// Both functions are additive exports — existing showPhoneMessage /
// showNearbyCameraOnPhone / showReportHandoffOnPhone behaviour is
// unchanged.

/** A stable CSS id for the <pre> that holds IMU sample lines. */
const IMU_LOG_PRE_ID = 'imu-probe-log'

/**
 * Initialise (or reset) the phone-side IMU probe log panel.
 *
 * Clears #phone-status, installs a heading, a scrollable <pre> for
 * JSON sample lines, and a "Copy IMU samples" button that copies all
 * accumulated lines to the clipboard.
 *
 * After calling this, use {@link appendPhoneLogLine} to add samples.
 */
export function initPhoneImuLog(): void {
  const element = clearRoot()
  if (!element) return

  // Heading — tells the user what they are looking at.
  const heading = document.createElement('h1')
  heading.textContent = 'IMU probe — raw samples'
  element.append(heading)

  // Sub-label explaining the format.
  element.append(
    paragraph(
      'Streaming raw IMU samples. Each line is JSON: {"t":<ms>,"x":…,"y":…,"z":…}',
    ),
  )

  // Scrollable <pre> that holds every sample line.
  const logPre = document.createElement('pre')
  logPre.id = IMU_LOG_PRE_ID
  logPre.style.whiteSpace = 'pre-wrap'
  logPre.style.textAlign = 'left'
  logPre.style.maxHeight = '60vh'
  logPre.style.overflowY = 'auto'
  logPre.style.fontSize = '0.85rem'
  element.append(logPre)

  // Copy button — mirrors the copyButton pattern in
  // showReportHandoffOnPhone so the user can grab all accumulated
  // lines for offline analysis.
  const copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.textContent = 'Copy IMU samples'
  copyButton.style.margin = '0.75rem 0'
  copyButton.addEventListener('click', async () => {
    const pre = document.querySelector<HTMLPreElement>(`#${IMU_LOG_PRE_ID}`)
    const text = pre?.textContent ?? ''
    if (!text) {
      copyButton.textContent = 'No samples yet'
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      copyButton.textContent = 'Samples copied'
    } catch {
      copyButton.textContent = 'Copy unavailable — select text above'
    }
  })
  element.append(copyButton)
}

/**
 * Append a single line to the IMU probe log panel created by
 * {@link initPhoneImuLog}.  If the panel has not been initialised
 * (or the <pre> is missing), this is a safe no-op.
 *
 * @param line  One JSON sample line to append.
 */
export function appendPhoneLogLine(line: string): void {
  const pre = document.querySelector<HTMLPreElement>(`#${IMU_LOG_PRE_ID}`)
  if (!pre) return

  // Append the text node + newline so the <pre> grows one line
  // per sample.  Auto-scroll to the latest line.
  pre.append(document.createTextNode(line + '\n'))
  pre.scrollTop = pre.scrollHeight
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
