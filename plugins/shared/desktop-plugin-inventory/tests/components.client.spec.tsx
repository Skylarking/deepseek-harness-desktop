// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  PluginInventorySettingsTab,
  type DesktopPluginManager,
  type PluginInventorySettingsTabInjected,
  type PluginInventorySettingsTabProps,
} from '../src/client/PluginInventorySettingsTab.tsx'
import { en, type PluginInventoryLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

type Snapshot = Awaited<ReturnType<PluginInventorySettingsTabInjected['list']>>
const t = ((key: PluginInventoryLocaleKey): string => en[key]) as PluginInventorySettingsTabProps['t']
const snapshot = {
  entries: [
    { entryId: 'system', moduleName: '@deepseek-ai/dsh-base', enabled: true, fiberPhase: 'active' },
    { entryId: 'managed', moduleName: '@fixture/local-plugin', enabled: true, fiberPhase: 'active' },
  ],
} as unknown as Snapshot

function props(manager?: DesktopPluginManager): PluginInventorySettingsTabProps {
  return {
    t,
    list: async () => snapshot,
    ...(manager === undefined ? {} : { manager }),
  } as PluginInventorySettingsTabProps
}

function manager(): DesktopPluginManager & {
  installLocal: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  setEnabled: ReturnType<typeof vi.fn>
} {
  return {
    installLocal: vi.fn(async () => ({ changed: false, message: 'cancelled' })),
    list: vi.fn(async () => [{
      name: '@fixture/local-plugin',
      spec: 'link:/plugins/local-plugin',
      enabled: true,
      localPath: '/plugins/local-plugin',
    }]),
    remove: vi.fn(async () => ({ changed: false, message: 'removed' })),
    setEnabled: vi.fn(async () => ({ changed: false, message: 'disabled' })),
  }
}

describe('Desktop plugin inventory component', () => {
  it('keeps browser deployments read-only when the Desktop manager is absent', async () => {
    render(<PluginInventorySettingsTab {...props()} />)

    expect(await screen.findByText('base')).toBeTruthy()
    expect(screen.getByText('local-plugin')).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.installLocal })).toBeNull()
    expect(screen.queryByRole('button', { name: en.disable })).toBeNull()
    expect(screen.queryByRole('button', { name: en.uninstall })).toBeNull()
  })

  it('exposes Desktop lifecycle controls and removes managed plugins from system components', async () => {
    const desktop = manager()
    render(<PluginInventorySettingsTab {...props(desktop)} />)

    expect(await screen.findByRole('heading', { name: en.installedPlugins })).toBeTruthy()
    expect(screen.getByText('/plugins/local-plugin')).toBeTruthy()
    expect(screen.getAllByText('local-plugin')).toHaveLength(1)
    expect(screen.getByText('base')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: en.installLocal }))
    await waitFor(() => { expect(desktop.installLocal).toHaveBeenCalledOnce() })
    await waitFor(() => {
      expect((screen.getByRole('button', { name: en.disable }) as HTMLButtonElement).disabled).toBe(false)
    })

    fireEvent.click(screen.getByRole('button', { name: en.disable }))
    await waitFor(() => { expect(desktop.setEnabled).toHaveBeenCalledWith('@fixture/local-plugin', false) })
    await waitFor(() => {
      expect((screen.getByRole('button', { name: en.uninstall }) as HTMLButtonElement).disabled).toBe(false)
    })

    fireEvent.click(screen.getByRole('button', { name: en.uninstall }))
    await waitFor(() => { expect(desktop.remove).toHaveBeenCalledWith('@fixture/local-plugin') })
  })
})
