import { useEffect, useState } from "react";
import { NodeCard } from "./NodeCard.js";
import { useTreeNavigation } from "./useTreeNavigation.js";
import { LevelUpIcon } from "./LevelUpIcon.js";
import type { Node } from "../../domain/Node.js";

/** Aligned to `--encap-drill` / `encap--leave` in `index.css` (ms, +padding). */
const DRILL_SETTLE_MS = 500;
const LEAVE_SETTLE_MS = 320;

type Props = {
  root: Node;
};

/**
 * One encapsulating node surface: the focused node and its direct children sit inside the same
 * card border. Drilling into a child uses CSS transitions; navigation commits after the settle
 * window (reduced motion commits immediately).
 */
export function TreeGraphScreen({ root }: Props) {
  const { view, focusChild, focusParent, canGoUp } = useTreeNavigation(root);
  const [drillTo, setDrillTo] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (drillTo == null) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      focusChild(drillTo);
      setDrillTo(null);
      return;
    }
    const id = drillTo;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      focusChild(id);
      setDrillTo(null);
    }, DRILL_SETTLE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [drillTo, focusChild]);

  useEffect(() => {
    if (!leaving) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      focusParent();
      setLeaving(false);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      focusParent();
      setLeaving(false);
    }, LEAVE_SETTLE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [leaving, focusParent]);

  if (!view) {
    return <p className="tree-error">No node to display.</p>;
  }

  const { center, children } = view;
  const hasChildren = children.length > 0;
  const isDrill = Boolean(drillTo);
  const busy = isDrill || leaving;

  return (
    <div className="tree-screen">
      <div className="tree-screen__bar">
        <button
          type="button"
          className="tree-back"
          onClick={() => {
            if (!canGoUp || busy) {
              return;
            }
            setLeaving(true);
          }}
          disabled={!canGoUp || busy}
          aria-disabled={!canGoUp || busy}
          aria-label="Back to parent level in the tree"
        >
          <LevelUpIcon className="tree-back__icon" />
          <span>Back to parent</span>
        </button>
      </div>
      <article
        className={[
          "encap",
          isDrill && "encap--drill",
          leaving && "encap--leave",
          hasChildren && "encap--with-nest",
        ]
          .filter(Boolean)
          .join(" ")}
        data-busy={busy || undefined}
        aria-busy={busy}
      >
        <div className="encap__head" aria-label="Focused node in this view">
          <NodeCard node={center} variant="center" />
        </div>
        {hasChildren && (
          <div
            className="encap__nest"
            role="group"
            aria-label="Direct children, inside the current node"
          >
            {children.map((c) => (
              <NodeCard
                key={c.id}
                node={c}
                variant="child"
                className={isDrill && drillTo === c.id ? "node-card--picking" : ""}
                onActivate={
                  busy
                    ? undefined
                    : () => {
                        setDrillTo(c.id);
                      }
                }
              />
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
