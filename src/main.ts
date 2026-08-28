import {
  AppLocationAccuracy,
  CreateStartUpPageContainer,
  OsEventTypeList,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type AppImageAsset,
  type AppLocation,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import './styles.css'
import {
  cameraDisplayName,
  fetchNearbyCameras,
  type NearbyCamera,
} from './deflock-data'
import { createDemoCameras, DEMO_LOCATION } from './demo-data'
import {
  cardinalDirection,
  formatDistance,
  normalizeDegrees,
} from './geo'
import {
  CAMERA_MOUNTS,
  CAMERA_PROFILES,
  buildReportTags,
  type ReportDraft,
} from './report'
import {
  showNearbyCameraOnPhone,
  showPhoneMessage,
  showReportHandoffOnPhone,
} from './phone-ui'

const MAIN_CONTAINER_ID = 1
const MAIN_CONTAINER_NAME = 'main'
const STORAGE_KEY = 'alprScout:lastReport'
const MAX_LINE_LENGTH = 42
const DEMO_NOTICE = 'DEMO DATA - live lookup unavailable'
const SHOW_DEMO_CAMERA =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'camera'

const HOME_ACTIONS = ['nearby', 'report', 'refresh'] as const
const PHOTO_CHOICES = ['Camera', 'Album', 'No photo'] as const

type HomeAction = (typeof HOME_ACTIONS)[number]
type PhotoChoice = (typeof PHOTO_CHOICES)[number]

type Screen =
  | { kind: 'loading'; message: string }
  | { kind: 'home'; selection: number; notice?: string }
  | { kind: 'nearby'; index: number; notice?: string }
  | { kind: 'report-location'; message: string }
  | { kind: 'report-photo'; selection: number; notice?: string }
  | { kind: 'report-profile'; selection: number }
  | { kind: 'report-mount'; selection: number }
  | { kind: 'report-direction'; direction: number }
  | { kind: 'report-confirm' }
  | { kind: 'report-ready'; notice?: string }

interface WorkingReport {
  location: AppLocation
  isDemoLocation: boolean
  photo?: AppImageAsset
  profileIndex: number
  mountIndex: number
  direction: number
}

function cycleIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return 0
  return ((index + delta) % length + length) % length
}

function truncate(value: string | undefined, limit = MAX_LINE_LENGTH): string {
  const text = value?.trim() || 'Unknown'
  return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`
}

function menuLine(selected: boolean, label: string): string {
  return `${selected ? '>' : ' '} ${label}`
}

class AlprScoutApp {
  private screen: Screen = { kind: 'loading', message: 'Starting...' }
  private nearby: NearbyCamera[] = []
  private lastLocation: AppLocation | null = null
  private report: WorkingReport | null = null
  private inputLocked = false

  constructor(private readonly bridge: EvenAppBridge) {}

  private async requestLocation(timeoutMs: number): Promise<AppLocation | null> {
    try {
      return (
        (await this.bridge.getAppLocation({
          accuracy: AppLocationAccuracy.High,
          timeoutMs,
        })) ?? null
      )
    } catch {
      // The simulator rejects location requests instead of resolving null.
      // Normalize both host behaviors so development fallback and production
      // permission handling follow the same path.
      return null
    }
  }

  private isUsingDemoCameras(): boolean {
    return this.nearby.length > 0 && this.nearby.every((camera) => camera.isDemo)
  }

  async start(): Promise<void> {
    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [
          new TextContainerProperty({
            xPosition: 0,
            yPosition: 0,
            width: 576,
            height: 288,
            borderWidth: 0,
            borderColor: 5,
            paddingLength: 8,
            containerID: MAIN_CONTAINER_ID,
            containerName: MAIN_CONTAINER_NAME,
            content: 'ALPR SCOUT\n\nStarting...',
            isEventCapture: 1,
          }),
        ],
      }),
    )

    if (result !== StartUpPageCreateResult.success) {
      throw new Error(`Unable to create the glasses page (${result})`)
    }

    this.bridge.onEvenHubEvent((event) => {
      void this.handleEvent(event)
    })

    await this.refreshNearby()
  }

  private async render(content: string): Promise<void> {
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: MAIN_CONTAINER_ID,
        containerName: MAIN_CONTAINER_NAME,
        content,
      }),
    )
  }

  private async renderCurrent(): Promise<void> {
    switch (this.screen.kind) {
      case 'loading':
        await this.render(`ALPR SCOUT\n\n${this.screen.message}`)
        return

      case 'home': {
        const screen = this.screen
        const labels = [
          `Nearby cameras (${this.nearby.length})`,
          'Report a camera',
          'Refresh nearby data',
        ]
        const rows = labels.map((label, index) =>
          menuLine(index === screen.selection, label),
        )
        await this.render(
          [
            'ALPR SCOUT',
            screen.notice ? truncate(screen.notice, 52) : '',
            '',
            ...rows,
            '',
            'Swipe select | Press open',
            'Double-press exit',
          ].join('\n'),
        )
        return
      }

      case 'nearby': {
        const camera = this.nearby[this.screen.index]
        if (!camera) {
          this.screen = { kind: 'home', selection: 0, notice: 'No nearby cameras found' }
          await this.renderCurrent()
          return
        }

        const facing = camera.tags.direction || camera.tags['camera:direction']
        await this.render(
          [
            `NEARBY ${this.screen.index + 1}/${this.nearby.length}`,
            cameraDisplayName(camera),
            `${formatDistance(camera.distanceMeters)} ${cardinalDirection(camera.bearingDegrees)}`,
            `Faces: ${truncate(facing, 28)}`,
            `Operator: ${truncate(camera.tags.operator, 30)}`,
            this.screen.notice || '',
            '',
            'Swipe cameras | Press phone',
            'Double-press back',
          ].join('\n'),
        )
        return
      }

      case 'report-location':
        await this.render(
          ['NEW CAMERA', '', this.screen.message, '', 'Double-press cancel'].join('\n'),
        )
        return

      case 'report-photo': {
        const screen = this.screen
        const rows = PHOTO_CHOICES.map((choice, index) =>
          menuLine(index === screen.selection, choice),
        )
        await this.render(
          [
            'REPORT 1/4 - PHOTO',
            screen.notice || 'Choose a reference photo',
            '',
            ...rows,
            '',
            'Swipe select | Press continue',
            'Double-press cancel',
          ].join('\n'),
        )
        return
      }

      case 'report-profile': {
        const profile = CAMERA_PROFILES[this.screen.selection]
        await this.render(
          [
            'REPORT 2/4 - MAKER',
            '',
            `> ${profile?.name ?? 'Unknown'}`,
            '',
            'Swipe through makers',
            'Press to choose',
            'Double-press cancel',
          ].join('\n'),
        )
        return
      }

      case 'report-mount': {
        const mount = CAMERA_MOUNTS[this.screen.selection]
        await this.render(
          [
            'REPORT 3/4 - MOUNT',
            '',
            `> ${(mount ?? 'pole').replaceAll('_', ' ')}`,
            '',
            'Swipe through mounts',
            'Press to choose',
            'Double-press cancel',
          ].join('\n'),
        )
        return
      }

      case 'report-direction':
        await this.render(
          [
            'REPORT 4/4 - DIRECTION',
            '',
            `> ${Math.round(this.screen.direction)}° ${cardinalDirection(this.screen.direction)}`,
            '',
            'Swipe changes 15°',
            'Press to review',
            'Double-press cancel',
          ].join('\n'),
        )
        return

      case 'report-confirm': {
        const report = this.requireReport()
        const profile = CAMERA_PROFILES[report.profileIndex]
        const mount = CAMERA_MOUNTS[report.mountIndex]
        await this.render(
          [
            'REVIEW REPORT',
            `${profile?.name ?? 'Unknown'} / ${(mount ?? 'pole').replaceAll('_', ' ')}`,
            `Facing ${Math.round(report.direction)}° ${cardinalDirection(report.direction)}`,
            `${report.isDemoLocation ? 'DEMO ' : ''}${report.location.latitude.toFixed(5)}, ${report.location.longitude.toFixed(5)}`,
            `Photo: ${report.photo ? 'yes' : 'no'}`,
            '',
            'Press: prepare phone handoff',
            'Double-press cancel',
          ].join('\n'),
        )
        return
      }

      case 'report-ready':
        await this.render(
          [
            'REPORT READY',
            '',
            this.screen.notice || 'Continue on your phone.',
            'Review tags before saving to OSM.',
            '',
            'Press: refresh phone handoff',
            'Double-press home',
          ].join('\n'),
        )
    }
  }

  private async refreshNearby(): Promise<void> {
    this.screen = { kind: 'loading', message: 'Finding your location...' }
    await this.renderCurrent()
    showPhoneMessage('ALPR Scout is finding nearby public camera records...')

    try {
      const location = await this.requestLocation(8_000)

      if (!location) {
        throw new Error('Location unavailable. Check phone permission and GPS.')
      }

      this.lastLocation = location
      this.screen = { kind: 'loading', message: 'Downloading nearby ALPR records...' }
      await this.renderCurrent()
      this.nearby = await fetchNearbyCameras(location)
      this.screen = {
        kind: 'home',
        selection: 0,
        notice: `${this.nearby.length} public cameras within 5 km`,
      }
      showPhoneMessage(
        `Found ${this.nearby.length} public ALPR records nearby. Use your glasses to browse or start a report.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nearby lookup failed'
      if (import.meta.env.DEV) {
        const demoOrigin = this.lastLocation ?? DEMO_LOCATION
        this.lastLocation = demoOrigin
        this.nearby = createDemoCameras(demoOrigin)
        this.screen = SHOW_DEMO_CAMERA
          ? { kind: 'nearby', index: 0, notice: DEMO_NOTICE }
          : {
              kind: 'home',
              selection: 0,
              notice: DEMO_NOTICE,
            }
        showPhoneMessage(
          `Live lookup failed (${message}). Loaded ${this.nearby.length} simulator demo cameras instead.`,
        )
      } else {
        this.screen = { kind: 'home', selection: 2, notice: truncate(message, 52) }
        showPhoneMessage(message)
      }
    }

    await this.renderCurrent()
  }

  private async beginReport(): Promise<void> {
    this.screen = { kind: 'report-location', message: 'Getting a precise phone location...' }
    await this.renderCurrent()

    const liveLocation = await this.requestLocation(5_000)
    const fallbackLocation = this.lastLocation ?? (import.meta.env.DEV ? DEMO_LOCATION : null)
    const location = liveLocation ?? fallbackLocation

    if (!location) {
      this.screen = {
        kind: 'home',
        selection: 1,
        notice: 'Location unavailable. Enable phone GPS and location permission.',
      }
      await this.renderCurrent()
      return
    }

    const isDemoLocation =
      !liveLocation &&
      import.meta.env.DEV &&
      (this.lastLocation === null || this.isUsingDemoCameras())

    this.lastLocation = location
    this.report = {
      location,
      isDemoLocation,
      profileIndex: 0,
      mountIndex: 0,
      direction: 0,
    }
    this.screen = {
      kind: 'report-photo',
      selection: 0,
      notice: liveLocation ? undefined : 'DEMO LOCATION - choose No photo',
    }
    await this.renderCurrent()
  }

  private async choosePhoto(choice: PhotoChoice): Promise<void> {
    const report = this.requireReport()

    if (choice === 'No photo') {
      report.photo = undefined
      this.screen = { kind: 'report-profile', selection: report.profileIndex }
      await this.renderCurrent()
      return
    }

    this.screen = {
      kind: 'report-location',
      message: choice === 'Camera' ? 'Opening phone camera...' : 'Opening phone album...',
    }
    await this.renderCurrent()

    const photo =
      choice === 'Camera'
        ? await this.bridge.captureImageFromCamera()
        : await this.bridge.pickImageFromAlbum()

    if (!photo) {
      this.screen = { kind: 'report-photo', selection: 0, notice: 'No photo selected' }
      await this.renderCurrent()
      return
    }

    report.photo = photo
    this.screen = { kind: 'report-profile', selection: report.profileIndex }
    await this.renderCurrent()
  }

  private requireReport(): WorkingReport {
    if (!this.report) throw new Error('Report state is unavailable')
    return this.report
  }

  private buildFinalReport(): ReportDraft {
    const report = this.requireReport()
    const profile = CAMERA_PROFILES[report.profileIndex]
    const mount = CAMERA_MOUNTS[report.mountIndex]

    if (!profile || !mount) throw new Error('Report selection is invalid')

    return {
      createdAt: new Date().toISOString(),
      isDemo: report.isDemoLocation,
      location: {
        latitude: report.location.latitude,
        longitude: report.location.longitude,
      },
      accuracyMeters: report.location.accuracy,
      profile,
      mount,
      direction: Math.round(normalizeDegrees(report.direction)),
      photoName: report.photo?.name,
      photoMimeType: report.photo?.mimeType,
      tags: buildReportTags(profile, mount, report.direction),
    }
  }

  private async finalizeReport(): Promise<void> {
    const working = this.requireReport()
    const draft = this.buildFinalReport()
    const saved = await this.bridge.setLocalStorage(STORAGE_KEY, JSON.stringify(draft))

    showReportHandoffOnPhone(draft, working.photo)
    this.screen = {
      kind: 'report-ready',
      notice: saved ? 'Draft saved. Continue on phone.' : 'Continue on phone; draft was not saved.',
    }
    await this.renderCurrent()
  }

  private async activateHomeAction(action: HomeAction): Promise<void> {
    if (action === 'nearby') {
      if (this.nearby.length === 0) {
        this.screen = { kind: 'home', selection: 0, notice: 'No nearby cameras to show' }
      } else {
        this.screen = { kind: 'nearby', index: 0 }
      }
      await this.renderCurrent()
      return
    }

    if (action === 'report') {
      await this.beginReport()
      return
    }

    await this.refreshNearby()
  }

  private async handleClick(): Promise<void> {
    switch (this.screen.kind) {
      case 'loading':
      case 'report-location':
        return

      case 'home': {
        const action = HOME_ACTIONS[this.screen.selection]
        if (action) await this.activateHomeAction(action)
        return
      }

      case 'nearby': {
        const camera = this.nearby[this.screen.index]
        if (!camera) return
        showNearbyCameraOnPhone(camera)
        this.screen = {
          ...this.screen,
          notice: camera.isDemo ? 'Demo details ready on phone' : 'Links ready on phone',
        }
        await this.renderCurrent()
        return
      }

      case 'report-photo': {
        const choice = PHOTO_CHOICES[this.screen.selection]
        if (choice) await this.choosePhoto(choice)
        return
      }

      case 'report-profile': {
        const report = this.requireReport()
        report.profileIndex = this.screen.selection
        this.screen = { kind: 'report-mount', selection: report.mountIndex }
        await this.renderCurrent()
        return
      }

      case 'report-mount': {
        const report = this.requireReport()
        report.mountIndex = this.screen.selection
        this.screen = { kind: 'report-direction', direction: report.direction }
        await this.renderCurrent()
        return
      }

      case 'report-direction': {
        const report = this.requireReport()
        report.direction = this.screen.direction
        this.screen = { kind: 'report-confirm' }
        await this.renderCurrent()
        return
      }

      case 'report-confirm':
        await this.finalizeReport()
        return

      case 'report-ready': {
        const report = this.requireReport()
        showReportHandoffOnPhone(this.buildFinalReport(), report.photo)
        this.screen = { kind: 'report-ready', notice: 'Phone handoff refreshed' }
        await this.renderCurrent()
      }
    }
  }

  private async handleSwipe(delta: number): Promise<void> {
    switch (this.screen.kind) {
      case 'home':
        this.screen = {
          ...this.screen,
          selection: cycleIndex(this.screen.selection, delta, HOME_ACTIONS.length),
        }
        break
      case 'nearby':
        this.screen = {
          kind: 'nearby',
          index: cycleIndex(this.screen.index, delta, this.nearby.length),
        }
        break
      case 'report-photo':
        this.screen = {
          ...this.screen,
          selection: cycleIndex(this.screen.selection, delta, PHOTO_CHOICES.length),
        }
        break
      case 'report-profile':
        this.screen = {
          ...this.screen,
          selection: cycleIndex(this.screen.selection, delta, CAMERA_PROFILES.length),
        }
        break
      case 'report-mount':
        this.screen = {
          ...this.screen,
          selection: cycleIndex(this.screen.selection, delta, CAMERA_MOUNTS.length),
        }
        break
      case 'report-direction':
        this.screen = {
          kind: 'report-direction',
          direction: normalizeDegrees(this.screen.direction + delta * 15),
        }
        break
      default:
        return
    }

    await this.renderCurrent()
  }

  private async handleDoubleClick(): Promise<void> {
    if (this.screen.kind === 'home' || this.screen.kind === 'loading') {
      await this.bridge.shutDownPageContainer(1)
      return
    }

    this.report = null
    this.screen = {
      kind: 'home',
      selection: 0,
      notice: this.isUsingDemoCameras()
        ? DEMO_NOTICE
        : this.lastLocation
          ? `${this.nearby.length} public cameras within 5 km`
          : undefined,
    }
    await this.renderCurrent()
  }

  private async handleEvent(event: EvenHubEvent): Promise<void> {
    const textEvent = event.textEvent
    const sysEvent = event.sysEvent

    if ((!textEvent && !sysEvent) || this.inputLocked) return
    if (textEvent && textEvent.containerID !== MAIN_CONTAINER_ID) return

    // A protobuf CLICK_EVENT has ordinal 0, so the simulator's system-event
    // payload omits eventType entirely. Treat that missing value as a click.
    const eventType = textEvent?.eventType ?? sysEvent?.eventType ?? OsEventTypeList.CLICK_EVENT

    this.inputLocked = true
    try {
      switch (eventType) {
        case OsEventTypeList.CLICK_EVENT:
          await this.handleClick()
          break
        case OsEventTypeList.SCROLL_TOP_EVENT:
          await this.handleSwipe(-1)
          break
        case OsEventTypeList.SCROLL_BOTTOM_EVENT:
          await this.handleSwipe(1)
          break
        case OsEventTypeList.DOUBLE_CLICK_EVENT:
          await this.handleDoubleClick()
          break
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed'
      const currentSelection = this.screen.kind === 'home' ? this.screen.selection : 1
      this.screen = { kind: 'home', selection: currentSelection, notice: truncate(message, 52) }
      showPhoneMessage(message)
      await this.renderCurrent()
    } finally {
      this.inputLocked = false
    }
  }
}

async function main(): Promise<void> {
  showPhoneMessage('ALPR Scout is connecting to your glasses...')
  const bridge = await waitForEvenAppBridge()
  await new AlprScoutApp(bridge).start()
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'ALPR Scout failed to start'
  console.error(error)
  showPhoneMessage(message)
})
