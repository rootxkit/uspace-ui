import type { Meta } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  ScrollArea,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../src/ui/index.js";
import { dark, light, type Demo, type Play } from "./story.js";

const meta = { title: "ui/Navigation" } satisfies Meta;
export default meta;

const TabsDemo: Demo = (t) => (
  <Tabs defaultValue="one" className="max-w-sm">
    <TabsList>
      <TabsTrigger value="one">{t.tabOne}</TabsTrigger>
      <TabsTrigger value="two">{t.tabTwo}</TabsTrigger>
    </TabsList>
    <TabsContent value="one">{t.tabOneBody}</TabsContent>
    <TabsContent value="two">{t.tabTwoBody}</TabsContent>
  </Tabs>
);
const tabsPlay: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const tabs = canvas.getAllByRole("tab");
  await expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  await userEvent.click(tabs[1] as HTMLElement);
  await expect(tabs[1]).toHaveAttribute("aria-selected", "true");
};
export const TabsLight = light(TabsDemo, { play: tabsPlay });
export const TabsDark = dark(TabsDemo, { play: tabsPlay });

const BreadcrumbDemo: Demo = (t) => (
  <Breadcrumb aria-label={t.breadcrumb}>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink href="#home">{t.crumbHome}</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbLink href="#zones">{t.crumbZones}</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>{t.crumbCurrent}</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
);
export const BreadcrumbLight = light(BreadcrumbDemo);
export const BreadcrumbDark = dark(BreadcrumbDemo);

// PaginationPrevious and PaginationNext carry English text upstream, so a
// translated console builds them from PaginationLink (UPGRADING.md).
const PaginationDemo: Demo = (t) => (
  <Pagination aria-label={t.pageNav}>
    <PaginationContent>
      <PaginationItem>
        <PaginationLink href="#1" size="default" aria-label={t.pagePrevious}>
          ‹
        </PaginationLink>
      </PaginationItem>
      {[1, 2, 3].map((n) => (
        <PaginationItem key={n}>
          <PaginationLink
            href={`#${n}`}
            isActive={n === 2}
            aria-label={`${t.page} ${n}`}
          >
            {n}
          </PaginationLink>
        </PaginationItem>
      ))}
      <PaginationItem>
        <PaginationLink href="#3" size="default" aria-label={t.pageNext}>
          ›
        </PaginationLink>
      </PaginationItem>
    </PaginationContent>
  </Pagination>
);
export const PaginationLight = light(PaginationDemo);
export const PaginationDark = dark(PaginationDemo);

const CollapsibleDemo: Demo = (t) => (
  <Collapsible className="max-w-sm">
    <CollapsibleTrigger asChild>
      <Button variant="outline">{t.collapsibleTrigger}</Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="pt-2">
      {t.collapsibleBody}
    </CollapsibleContent>
  </Collapsible>
);
const collapsiblePlay: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole("button");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(trigger);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    canvasElement.querySelector('[data-slot="collapsible-content"]'),
  ).toBeVisible();
};
export const CollapsibleLight = light(CollapsibleDemo, {
  play: collapsiblePlay,
});
export const CollapsibleDark = dark(CollapsibleDemo, { play: collapsiblePlay });

const ScrollAreaDemo: Demo = (t) => (
  <ScrollArea className="h-40 w-64 rounded-md border">
    <ul className="p-3" aria-label={t.scrollLabel}>
      {Array.from({ length: 20 }, (_, i) => (
        <li key={i} className="py-1 text-sm">
          <a href={`#event-${i + 1}`} className="underline">
            {t.scrollRow} {i + 1}
          </a>
        </li>
      ))}
    </ul>
  </ScrollArea>
);
export const ScrollAreaLight = light(ScrollAreaDemo);
export const ScrollAreaDark = dark(ScrollAreaDemo);

const TableDemo: Demo = (t) => (
  <Table>
    <TableCaption>{t.tableCaption}</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>{t.tableName}</TableHead>
        <TableHead>{t.tableState}</TableHead>
        <TableHead className="text-right">{t.tableAge}</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>TEST-RX-01</TableCell>
        <TableCell>{t.tableLive}</TableCell>
        <TableCell className="text-right">2</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>TEST-RX-02</TableCell>
        <TableCell>{t.tableStale}</TableCell>
        <TableCell className="text-right">94</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
export const TableLight = light(TableDemo);
export const TableDark = dark(TableDemo);
