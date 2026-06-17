// Remove any existing e2e container before Playwright runs. Without this, a
// container leaked from a previous failed run would either occupy the host
// port (causing Playwright's reuseExistingServer:false guard to abort) or
// conflict on the container name (causing `docker run --name` to fail).
import { execFileSync } from 'node:child_process'

const name = process.env.E2E_CONTAINER ?? 'project-an-e2e'
try {
  execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
} catch {
  // No such container — nothing to clean up.
}
