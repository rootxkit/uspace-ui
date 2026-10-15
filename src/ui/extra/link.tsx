import type { ReactNode } from "react";

/**
 * What a frame component passes to render one of its links: the target,
 * the classes, whether it is the current page, the content. An app with a
 * router passes its own (`(p) => <Link {...p} />` for next/link) so
 * navigation stays client-side; the default renders a plain `<a>`.
 *
 * @public
 */
export interface LinkProps {
  href: string;
  className?: string;
  "aria-current"?: "page";
  children?: ReactNode;
}

/** @public */
export type LinkRenderer = (props: LinkProps) => ReactNode;

/** The default LinkRenderer: a plain anchor. */
export const plainLink: LinkRenderer = ({ children, ...rest }) => (
  <a {...rest}>{children}</a>
);
