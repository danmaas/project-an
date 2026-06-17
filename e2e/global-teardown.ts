import { execFileSync } from 'node:child_process'
import { CONTAINER_NAME } from './playwright.config'

// Belt-and-suspenders: force-remove the container even if Playwright's signal
// propagation didn't bring it down. `docker run --rm` should handle the happy
// path on its own; this is the safety net for the unhappy path.
export default async function globalTeardown(): Promise<void> {
  try {
    execFileSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' })
  } catch {
    // Container already gone — nothing to do.
  }
}
