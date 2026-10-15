"use client";
// MapPanel (1.1.0): the frame of a console's map. A Panel header with
// the map's title and actions, a body of a set height that the MapView
// fills, and the legend laid over the map's lower-left corner (the
// controls are top right, the notices top centre, the attribution bottom
// right). The legend can be folded to a chip and opened again; it is
// never removed while the map shows, so its meanings stay one click away.
// The frame imports nothing of MapLibre: the map is the app's child.
import { ChevronDown, Layers } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { useT } from "../../i18n/I18nProvider.js";
import { cn } from "../cn.js";
import { Panel } from "./Panel.js";

/** @public */
export interface MapPanelProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** The legends to lay over the map, such as a ZoneLegend. */
  legend?: ReactNode;
  /** The legend's heading; "Legend" by default. */
  legendTitle?: ReactNode;
  /** Whether the legend starts open; true by default. */
  defaultLegendOpen?: boolean;
  /**
   * Classes of the map's box, which sets its height: `h-[28rem]` by
   * default. The map also grows to fill a panel stretched taller. A class, not a style, so the server-rendered page carries no
   * inline style for the CSP (PLAN §7) to refuse.
   */
  mapClassName?: string;
  footer?: ReactNode;
  /** The map: a MapView with its layers. */
  children?: ReactNode;
  className?: string;
}

/** @public */
export function MapPanel(props: MapPanelProps): ReactNode {
  const {
    title,
    description,
    actions,
    legend,
    legendTitle,
    defaultLegendOpen = true,
    mapClassName = "h-[28rem]",
    footer,
    children,
    className,
  } = props;
  const t = useT();
  const legendId = useId();
  const [open, setOpen] = useState(defaultLegendOpen);
  return (
    <Panel
      title={title}
      description={description}
      actions={actions}
      footer={footer}
      padding="none"
      bodyClassName="flex flex-col"
      className={className}
      data-map-panel=""
    >
      <div
        data-part="map"
        className={cn("relative min-h-48 flex-auto", mapClassName)}
      >
        {children}
        {legend !== undefined && (
          <div
            data-part="legend"
            data-open={open ? "true" : "false"}
            className="absolute bottom-3 left-3 z-[4] flex max-h-[calc(100%-1.5rem)] max-w-[min(18rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-overlay"
          >
            <button
              type="button"
              aria-expanded={open}
              aria-controls={legendId}
              onClick={() => {
                setOpen(!open);
              }}
              className="flex h-8 shrink-0 items-center gap-2 px-3 text-xs font-semibold text-foreground transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <Layers
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
              <span>{legendTitle ?? t("panel.legend")}</span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "ml-auto size-3.5 text-muted-foreground transition-transform",
                  open ? "rotate-0" : "-rotate-90",
                )}
              />
            </button>
            <div
              id={legendId}
              hidden={!open}
              className="min-h-0 overflow-y-auto border-t border-border px-3 py-2 text-xs"
            >
              {legend}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
