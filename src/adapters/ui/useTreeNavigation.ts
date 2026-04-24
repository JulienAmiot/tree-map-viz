import { useCallback, useRef, useState } from "react";
import type { Node } from "../../domain/Node.js";
import { TreeNavigationService } from "../../application/TreeNavigationService.js";
import type { FocusedTreeView } from "../../application/ports/TreeNavigationPort.js";

/**
 * UI adapter: binds {@link TreeNavigationService} to React state so the hexagonal core stays framework-agnostic.
 */
export function useTreeNavigation(root: Node) {
  const serviceRef = useRef<TreeNavigationService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new TreeNavigationService(root);
  }

  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((x) => x + 1), []);

  const svc = serviceRef.current;
  const view: FocusedTreeView | null = svc.getFocusedView();
  const focusedId = svc.getFocusedId();
  const canGoUp = focusedId !== svc.getRoot().id;

  const focusChild = useCallback(
    (childId: string) => {
      const r = serviceRef.current?.focusChild(childId);
      if (r?.ok) {
        bump();
      }
      return r;
    },
    [bump],
  );

  const focusParent = useCallback(() => {
    const r = serviceRef.current?.focusParent();
    if (r?.ok) {
      bump();
    }
    return r;
  }, [bump]);

  return {
    view,
    focusChild,
    focusParent,
    canGoUp,
    focusedId,
  };
}
