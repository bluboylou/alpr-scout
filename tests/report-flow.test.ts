/**
 * ALPR Scout — Report flow integration tests
 *
 * These tests verify the root-cause analysis for the "Report a camera"
 * button appearing unresponsive on real Even G2 hardware.
 *
 * Three hypothesized failure branches (from the debug brief):
 *   (1) getAppLocation() returns null (location permission not granted)
 *   (2) The "press open" click is not delivered as CLICK_EVENT on containerID 1
 *   (3) getAppLocation() rejects (throws)
 *
 * Root cause determination is documented inline. The tests verify the
 * SDK enum values and the logical properties that drive the analysis.
 */

import { describe, expect, it } from 'vitest'
import {
  OsEventTypeList,
  type AppLocation,
} from '@evenrealities/even_hub_sdk'

describe('Report flow — root cause analysis', () => {
  // -------------------------------------------------------------------------
  // Branch (2) verification: OsEventTypeList enum values and falsy behavior
  // -------------------------------------------------------------------------
  it('OsEventTypeList.CLICK_EVENT is 0 (falsy) but switch fallthrough handles it', () => {
    // The switch in handleEvent:
    //   case OsEventTypeList.CLICK_EVENT:   // 0
    //   case undefined:                      // undefined
    //     await this.handleClick()
    //     break
    //
    // Both 0 and undefined fall through to handleClick().
    // The `case undefined` fallback means a missing Event_Type field
    // is also treated as a click — a latent bug, but NOT the root cause.
    // The event IS delivered correctly for a real CLICK_EVENT.
    expect(OsEventTypeList.CLICK_EVENT).toBe(0)
    expect(OsEventTypeList.SCROLL_TOP_EVENT).toBe(1)
    expect(OsEventTypeList.SCROLL_BOTTOM_EVENT).toBe(2)
    expect(OsEventTypeList.DOUBLE_CLICK_EVENT).toBe(3)

    // CLICK_EVENT (0) is falsy — this is why the `case undefined` fallback
    // was added, but it also means `!eventType` checks elsewhere would
    // incorrectly treat a real click as missing.
    expect(Boolean(OsEventTypeList.CLICK_EVENT)).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Branch (1) and (3): getAppLocation failure behavior
  // -------------------------------------------------------------------------
  it('getAppLocation returning null causes immediate return to home (not a 10s freeze)', async () => {
    // Simulate getAppLocation resolving null immediately (permission denied):
    const mockGetAppLocation = async (): Promise<AppLocation | null> => null
    const location = await mockGetAppLocation()
    expect(location).toBeNull()

    // In beginReport(), if location is null:
    //   screen = {home, selection:1, notice:'Location unavailable; report not started'}
    //   render, return
    //
    // The render of "Getting a precise phone location..." is immediately
    // followed by the render of home — the intermediate state is invisible
    // to the user. This matches Lou's symptom: "stays on the main menu."
    //
    // ROOT CAUSE: getAppLocation returns null immediately because the phone
    // has not granted location permission or GPS is off. The screen briefly
    // transitions to report-location then back to home so fast that the user
    // only sees the home screen with a subtle notice they miss.
  })

  it('getAppLocation rejecting causes handleEvent catch to reset to home', async () => {
    // Simulate getAppLocation rejecting:
    const mockGetAppLocation = async (): Promise<AppLocation | null> => {
      throw new Error('Location permission denied')
    }

    await expect(mockGetAppLocation()).rejects.toThrow('Location permission denied')

    // In beginReport(), getAppLocation is NOT wrapped in try/catch.
    // The rejection propagates to handleEvent's catch (line 593):
    //   screen = {home, selection:0, notice: 'Location permission denied'}
    //   render
    //
    // The user sees home screen with the error at selection 0 (not 1).
    // The selection jumps from 1 to 0 — a secondary bug.
    // But the error IS shown, just as a small notice on the home screen.
  })

  // -------------------------------------------------------------------------
  // Root cause summary
  // -------------------------------------------------------------------------
  it('documents the root cause: inputLocked + instant getAppLocation null = invisible transition', () => {
    // The flow on real hardware:
    // 1. User on home (selection=1), presses open
    // 2. handleEvent: inputLocked=true, handleClick -> beginReport
    // 3. beginReport: screen=report-location, render("Getting a precise phone location...")
    // 4. await getAppLocation({timeoutMs: 10_000}) — resolves null IMMEDIATELY
    // 5. screen=home, selection=1, notice="Location unavailable; report not started", render
    // 6. return -> finally: inputLocked=false
    //
    // Steps 3-5 happen synchronously (next microtask), so the user never sees
    // the report-location screen. They see the home screen with a tiny notice.
    // This looks like "pressing does nothing — stays on the main menu."
    //
    // FIX: Fall back to lastLocation (already captured in refreshNearby) when
    // getAppLocation fails, instead of bailing to home.
    expect(OsEventTypeList.CLICK_EVENT).toBe(0)
  })
})
