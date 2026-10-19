import { getCloudflareContext } from '@opennextjs/cloudflare'
import { db } from './db'
import { backupDay, createBackup, type BackupStorage } from './backup-core'
export const backupsAvailable = () => process.env.ACADEMY_BACKUPS_AVAILABLE !== '0'
export async function backupStorage(): Promise<BackupStorage> {
  if (!backupsAvailable()) throw new Error('Backups are disabled for this deployment')
  if (process.env.ACADEMY_USE_D1 === '1') {
    const { env } = await getCloudflareContext({ async: true })
    const bucket = (env as unknown as { BACKUPS?: { put(key: string, value: string): Promise<unknown>; get(key: string): Promise<{ text(): Promise<string> } | null> } }).BACKUPS
    if (!bucket) throw new Error('Configure private BACKUPS R2 binding')
    return { put: (key, data) => bucket.put(key, data), get: async key => (await bucket.get(key))?.text() ?? null }
  }
  const { mkdir, writeFile, readFile } = await import('node:fs/promises'); const { join } = await import('node:path')
  const directory = join(process.env.ACADEMY_DATA_DIR || join(process.cwd(), '.data'), 'backups')
  await mkdir(directory, { recursive: true })
  const path = (key: string) => { if (!/^academy_demo-[\w-]+\.json$/.test(key)) throw new Error('Invalid backup path'); return join(directory, key) }
  return { put: (key, data) => writeFile(path(key), data, { flag: 'wx' }), get: async key => { try { return await readFile(path(key), 'utf8') } catch { return null } } }
}
export async function runDailyBackup() {
  if (!backupsAvailable()) return null
  if (!backupDay(new Date()).due) return null
  if ((await db().prepare("SELECT value FROM system_settings WHERE key='backups_enabled'").get())?.value !== '1') return null
  return createBackup(db(), await backupStorage(), true)
}
