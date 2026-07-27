let isInstalled = false;

export function installRemoveChildGuard() {
  if (isInstalled) return;
  isInstalled = true;

  const originalRemoveChild = Node.prototype.removeChild;

  Node.prototype.removeChild = function guardedRemoveChild<T extends Node>(child: T): T {
    if (child && child.parentNode !== this) {
      // React can occasionally attempt to remove an SVG/DOM node that was already
      // detached by browser-side DOM reconciliation or legacy wireups. Treat that
      // specific stale-removal case as a no-op so the whole app does not whiteout.
      return child;
    }

    return originalRemoveChild.call(this, child) as T;
  };
}
