// ABOUTME: Tells a module whether Node was started with it, so one file can be both imported and run as a command.
// ABOUTME: The release stamp tool and the test server run their command lines only when started this way.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Whether Node was started with the module at moduleUrl. Node names a module by its real path, so the path Node was
// started with is resolved through any symlinks, such as macOS's /tmp, before comparing.
export function startedAsCommand(moduleUrl) {
  return process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(moduleUrl);
}
