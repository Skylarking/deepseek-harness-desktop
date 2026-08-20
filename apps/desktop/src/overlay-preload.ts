/** Narrow bridge for plugin-owned Desktop overlay movement and task-panel sizing. */
import { contextBridge, ipcRenderer } from 'electron'

window.open = () => null

contextBridge.exposeInMainWorld('dshDesktopOverlay', {
  moveBy: (x: number, y: number) => { ipcRenderer.send('desktop:overlay:move-by', x, y) },
  setCompactSize: (width: number, height: number) => { ipcRenderer.send('desktop:overlay:set-compact-size', width, height) },
  setExpanded: (expanded: boolean) => { ipcRenderer.send('desktop:overlay:set-expanded', expanded) },
  setVisible: (visible: boolean) => { ipcRenderer.send('desktop:overlay:set-visible', visible) },
})
