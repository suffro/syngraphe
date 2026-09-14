# Directory identity checks bound the portable write protection

## Decision

Keep the shared Node filesystem implementation and add a per-operation `WriteGuard` in the same
module. It records directory device/inode identities from Git root to the destination parent and
rechecks them during every phase, including fallback and cleanup. A check failure is latched, so a
subsequent restoration of the path cannot restart cleanup. Missing directories are created one at a
time. Temporary files are opened exclusively and written through the handle after another check.

The hard-link fallback accepts only `EPERM`, `ENOTSUP`, `EOPNOTSUPP`, `ENOSYS` and `EXDEV`.
`EPERM` remains for filesystems/platforms that use it for unsupported links; it is ambiguous, so it
also requires a fresh directory check. Missing paths, IO errors and disk exhaustion are propagated.

If a parent changes after a patch moved the original aside, the error retains the unsafe-path exit
code and explains how to recover the temporary name in the moved directory. No cleanup is attempted
through the replacement parent. File creation remains exclusive and patch content verification is
unchanged. Existing publication and rename seams exercise these interleavings deterministically.

## Why

The old path check finished before staging. A parent exchanged for an outside symlink afterwards
could redirect writes. Catching every failed link and falling back to a path-based write compounded
the problem; unconditional temporary-file cleanup could also reach the replacement directory.

The regression suite reproduced these failures before implementation, then passed with the guard.
It also covers replacement by a regular directory, and preservation of the original when a parent
changes during the rename-aside step.

## Limit

This is mitigation, not full elimination of the hostile directory-swap race. Repeated checks cannot
atomically bind a path-based syscall to the directory identity just checked. Node's portable
[filesystem API](https://nodejs.org/api/fs.html) does not expose the directory-relative mutation
primitives needed for that isolation. Mutating commands require a trusted directory tree; the public
safety documentation now states this rather than promising an unconditional sandbox.

Adding a native implementation per platform or spawning a separate process for every write would
introduce a new runtime/deployment model, including the standalone bundled Action. That expansion is
not part of this hardening. The separate already-open-file-descriptor residual of decision 0006
continues to apply.
