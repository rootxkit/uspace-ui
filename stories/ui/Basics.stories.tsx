import type { Meta } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  InlineCode,
  Kbd,
  STAT_UNKNOWN,
  Separator,
  Skeleton,
  Stat,
} from "../../src/ui/index.js";
import { dark, light, type Demo, type Play } from "./story.js";

const meta = { title: "ui/Basics" } satisfies Meta;
export default meta;

const ButtonDemo: Demo = (t) => (
  <div className="flex flex-wrap gap-2">
    <Button>{t.save}</Button>
    <Button variant="destructive">{t.delete}</Button>
    <Button variant="outline">{t.outline}</Button>
    <Button variant="secondary">{t.secondary}</Button>
    <Button variant="ghost">{t.ghost}</Button>
    <Button variant="link">{t.link}</Button>
    <Button disabled>{t.cancel}</Button>
  </div>
);
export const ButtonLight = light(ButtonDemo);
export const ButtonDark = dark(ButtonDemo);

const BadgeDemo: Demo = (t) => (
  <div className="flex flex-wrap gap-2">
    <Badge>{t.badge}</Badge>
    <Badge variant="secondary">{t.badge}</Badge>
    <Badge variant="destructive">{t.badge}</Badge>
    <Badge variant="outline">{t.badge}</Badge>
  </div>
);
export const BadgeLight = light(BadgeDemo);
export const BadgeDark = dark(BadgeDemo);

const CardDemo: Demo = (t) => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>{t.cardTitle}</CardTitle>
      <CardDescription>{t.cardDescription}</CardDescription>
    </CardHeader>
    <CardContent>{t.cardBody}</CardContent>
    <CardFooter>
      <Button variant="outline">{t.close}</Button>
    </CardFooter>
  </Card>
);
export const CardLight = light(CardDemo);
export const CardDark = dark(CardDemo);

const SeparatorDemo: Demo = (t) => (
  <div className="max-w-sm">
    <p>{t.separatorTop}</p>
    <Separator className="my-2" />
    <p>{t.separatorBottom}</p>
  </div>
);
export const SeparatorLight = light(SeparatorDemo);
export const SeparatorDark = dark(SeparatorDemo);

const SkeletonDemo: Demo = (t) => (
  <div role="status" aria-label={t.skeletonLabel} className="flex gap-2">
    <Skeleton className="size-10 rounded-full" />
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
);
export const SkeletonLight = light(SkeletonDemo);
export const SkeletonDark = dark(SkeletonDemo);

const KbdDemo: Demo = (t) => (
  <p>
    {t.kbd} <Kbd>Esc</Kbd> {t.kbdTail}
  </p>
);
export const KbdLight = light(KbdDemo);
export const KbdDark = dark(KbdDemo);

const InlineCodeDemo: Demo = (t) => (
  <p>
    {t.codeLead} <InlineCode>--us-severity-critical</InlineCode>
  </p>
);
export const InlineCodeLight = light(InlineCodeDemo);
export const InlineCodeDark = dark(InlineCodeDemo);

// A known value with its unit, and an unknown one: a dash, never a zero.
const StatDemo: Demo = (t) => (
  <div className="flex gap-8">
    <Stat label={t.statLabel} value={87} unit={t.statUnit} />
    <Stat label={t.statUnknownLabel} value={null} unit="m/s" />
  </div>
);
const statPlay: Play = async ({ canvasElement }) => {
  const stats = canvasElement.querySelectorAll('[data-slot="stat"]');
  await expect(stats).toHaveLength(2);
  await expect(stats[0]).toHaveTextContent(/87/);
  await expect(stats[0]?.querySelector("[data-unknown]")).toBeNull();
  await expect(stats[1]).toHaveTextContent(STAT_UNKNOWN);
  await expect(stats[1]).not.toHaveTextContent("0");
  await expect(stats[1]).not.toHaveTextContent("m/s");
  await expect(stats[1]?.querySelector("[data-unknown]")).not.toBeNull();
};
export const StatLight = light(StatDemo, { play: statPlay });
export const StatDark = dark(StatDemo, { play: statPlay });

const EmptyStateDemo: Demo = (t) => (
  <EmptyState
    title={t.emptyTitle}
    description={t.emptyDescription}
    action={<Button variant="outline">{t.close}</Button>}
  />
);
const emptyPlay: Play = async ({ canvasElement }) => {
  await expect(within(canvasElement).getByRole("status")).toBeVisible();
};
export const EmptyStateLight = light(EmptyStateDemo, { play: emptyPlay });
export const EmptyStateDark = dark(EmptyStateDemo, { play: emptyPlay });
