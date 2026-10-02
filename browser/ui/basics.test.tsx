import { within } from "@testing-library/react";
import { expect } from "vitest";

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
import { testDemo, type Check, type Demo } from "./demo.js";

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
testDemo("Button", ButtonDemo);

const BadgeDemo: Demo = (t) => (
  <div className="flex flex-wrap gap-2">
    <Badge>{t.badge}</Badge>
    <Badge variant="secondary">{t.badge}</Badge>
    <Badge variant="destructive">{t.badge}</Badge>
    <Badge variant="outline">{t.badge}</Badge>
  </div>
);
testDemo("Badge", BadgeDemo);

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
testDemo("Card", CardDemo);

const SeparatorDemo: Demo = (t) => (
  <div className="max-w-sm">
    <p>{t.separatorTop}</p>
    <Separator className="my-2" />
    <p>{t.separatorBottom}</p>
  </div>
);
testDemo("Separator", SeparatorDemo);

const SkeletonDemo: Demo = (t) => (
  <div role="status" aria-label={t.skeletonLabel} className="flex gap-2">
    <Skeleton className="size-10 rounded-full" />
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
);
testDemo("Skeleton", SkeletonDemo);

const KbdDemo: Demo = (t) => (
  <p>
    {t.kbd} <Kbd>Esc</Kbd> {t.kbdTail}
  </p>
);
testDemo("Kbd", KbdDemo);

const InlineCodeDemo: Demo = (t) => (
  <p>
    {t.codeLead} <InlineCode>--us-severity-critical</InlineCode>
  </p>
);
testDemo("InlineCode", InlineCodeDemo);

// A known value with its unit, and an unknown one: a dash, never a zero.
const StatDemo: Demo = (t) => (
  <div className="flex gap-8">
    <Stat label={t.statLabel} value={87} unit={t.statUnit} />
    <Stat label={t.statUnknownLabel} value={null} unit="m/s" />
  </div>
);
const statCheck: Check = async (canvasElement) => {
  const stats = canvasElement.querySelectorAll('[data-slot="stat"]');
  expect(stats).toHaveLength(2);
  expect(stats[0]).toHaveTextContent(/87/);
  expect(stats[0]?.querySelector("[data-unknown]")).toBeNull();
  expect(stats[1]).toHaveTextContent(STAT_UNKNOWN);
  expect(stats[1]).not.toHaveTextContent("0");
  expect(stats[1]).not.toHaveTextContent("m/s");
  expect(stats[1]?.querySelector("[data-unknown]")).not.toBeNull();
};
testDemo("Stat", StatDemo, statCheck);

const EmptyStateDemo: Demo = (t) => (
  <EmptyState
    title={t.emptyTitle}
    description={t.emptyDescription}
    action={<Button variant="outline">{t.close}</Button>}
  />
);
const emptyCheck: Check = async (canvasElement) => {
  expect(within(canvasElement).getByRole("status")).toBeVisible();
};
testDemo("EmptyState", EmptyStateDemo, emptyCheck);
