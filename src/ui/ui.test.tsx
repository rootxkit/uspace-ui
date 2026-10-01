// The `ui` entry point in jsdom: every vendored component renders through
// the index with the role and state it promises, and the kit's additions
// show what they say they show. The look and axe run in the stories
// (stories/ui/); this file proves the exports are wired and the states
// render (E-01: every "nothing" has its "something").
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ThemeProvider, type Brand } from "../theme/index.js";
import * as ui from "./index.js";
import { useTheme as nextThemesUseTheme } from "./next-themes.js";

const {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  EmptyState,
  InlineCode,
  Input,
  Kbd,
  Label,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  STAT_UNKNOWN,
  ScrollArea,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Stat,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} = ui;

const BRAND: Brand = {
  name: "U-space",
  shortName: "U-space",
  logoUrl: null,
  contact: null,
  accent: null,
};

// jsdom lacks the layout APIs Radix and cmdk call; stubbed per test and
// restored after it (E-11).
const scrollIntoView = Element.prototype.scrollIntoView;
const pointerCapture = Element.prototype.hasPointerCapture;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  Element.prototype.scrollIntoView = scrollIntoView;
  Element.prototype.hasPointerCapture = pointerCapture;
  document.documentElement.removeAttribute("data-theme");
});

const wrap = (node: ReactNode, scheme: "light" | "dark" = "light") =>
  render(
    <ThemeProvider brand={BRAND} scheme={scheme}>
      <TooltipProvider>{node}</TooltipProvider>
    </ThemeProvider>,
  );

describe("cn", () => {
  it("joins classes and lets the later Tailwind class win", () => {
    const hidden = false as boolean;
    expect(cn("p-2", hidden && "hidden", "p-4")).toBe("p-4");
    expect(cn("text-sm", ["font-medium", { underline: true }])).toBe(
      "text-sm font-medium underline",
    );
  });
});

describe("the next-themes stand-in", () => {
  function Probe() {
    return <p data-testid="t">{nextThemesUseTheme().theme}</p>;
  }

  it("reports the kit's resolved scheme inside a ThemeProvider", () => {
    wrap(<Probe />, "dark");
    expect(screen.getByTestId("t").textContent).toBe("dark");
  });

  it("falls back to system outside one", () => {
    render(<Probe />);
    expect(screen.getByTestId("t").textContent).toBe("system");
  });
});

describe("vendored components", () => {
  it("renders buttons, badges and cards with their slots", () => {
    wrap(
      <>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
        <Button asChild variant="link">
          <a href="#x">Link</a>
        </Button>
        <Badge variant="outline">TEST</Badge>
        <Badge asChild>
          <a href="#b">Linked badge</a>
        </Badge>
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
            <CardAction>Action</CardAction>
          </CardHeader>
          <CardContent>Body</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      </>,
    );
    expect(
      screen.getByRole("button", { name: "Delete" }).dataset["slot"],
    ).toBe("button");
    expect(screen.getByRole("link", { name: "Link" }).dataset["slot"]).toBe(
      "button",
    );
    expect(screen.getByText("TEST").dataset["slot"]).toBe("badge");
    expect(screen.getByText("Linked badge").tagName).toBe("A");
    for (const slot of [
      "card",
      "card-header",
      "card-title",
      "card-description",
      "card-action",
      "card-content",
      "card-footer",
    ]) {
      expect(document.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }
  });

  it("opens a dialog with its title and closes it", () => {
    const onOpenChange = vi.fn();
    wrap(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge</DialogTitle>
            <DialogDescription>Recorded with your name.</DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <DialogClose>Cancel</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Acknowledge" });
    // The upstream close buttons: the corner X and the footer's.
    expect(within(dialog).getAllByRole("button", { name: "Close" })).toHaveLength(
      2,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders an alert dialog with both actions", () => {
    wrap(
      <AlertDialog open>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Disable?</AlertDialogTitle>
            <AlertDialogDescription>It stops feeding.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Disable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Disable?" });
    expect(within(dialog).getAllByRole("button")).toHaveLength(2);
  });

  it.each(["top", "right", "bottom", "left"] as const)(
    "renders a sheet on the %s side",
    (side) => {
      wrap(
        <Sheet open>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>Layers</SheetTitle>
              <SheetDescription>What the map shows.</SheetDescription>
            </SheetHeader>
            <SheetFooter>Footer</SheetFooter>
          </SheetContent>
        </Sheet>,
      );
      expect(screen.getByRole("dialog", { name: "Layers" })).toBeTruthy();
    },
  );

  it("switches tabs", () => {
    wrap(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole("tabpanel").textContent).toBe("Panel A");
    const b = screen.getByRole("tab", { name: "B" });
    fireEvent.mouseDown(b, { button: 0 });
    expect(b.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Panel B");
  });

  it("shows tooltip and popover content when open", () => {
    wrap(
      <>
        <Tooltip open>
          <TooltipTrigger>Hover</TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
        <Popover open>
          <PopoverTrigger>Details</PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Heading</PopoverTitle>
              <PopoverDescription>More</PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </>,
    );
    expect(screen.getByRole("tooltip").textContent).toBe("Tip");
    expect(screen.getByRole("dialog").textContent).toContain("Heading");
  });

  it("renders a dropdown menu with items, a checkbox and a radio group", () => {
    wrap(
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel inset>Track</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive">
              Remove <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem checked>Follow</DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuRadioGroup value="amsl">
            <DropdownMenuRadioItem value="amsl">AMSL</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="agl">AGL</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const menu = screen.getByRole("menu");
    expect(
      within(menu).getByRole("menuitemcheckbox").getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      within(menu)
        .getByRole("menuitemradio", { name: "AMSL" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("filters a command list and says when nothing matches", async () => {
    wrap(
      <Command>
        <CommandInput aria-label="Search" />
        <CommandList>
          <CommandEmpty>Nothing found</CommandEmpty>
          <CommandGroup heading="Views">
            <CommandItem>
              Map <CommandShortcut>M</CommandShortcut>
            </CommandItem>
            <CommandItem>Alerts</CommandItem>
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </Command>,
    );
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByText("Nothing found")).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "zzz" },
    });
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    expect(screen.getByText("Nothing found")).toBeTruthy();
  });

  it("renders the command dialog with its title", () => {
    wrap(
      <CommandDialog open title="Jump to" description="Pick a view">
        <CommandInput aria-label="Search" />
      </CommandDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Jump to" })).toBeTruthy();
  });

  it("shows the selected value of a select", () => {
    wrap(
      <Select defaultValue="ka">
        <SelectTrigger size="sm" aria-label="Language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Languages</SelectLabel>
            <SelectItem value="en">English</SelectItem>
            <SelectSeparator />
            <SelectItem value="ka">Georgian</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole("combobox").textContent).toBe("Georgian");
  });

  it("renders the select list when open", () => {
    wrap(
      <Select defaultValue="en" open>
        <SelectTrigger aria-label="Language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="ka">Georgian</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("toggles a checkbox, a switch and a radio group", () => {
    const onChecked = vi.fn();
    const onSwitch = vi.fn();
    const onRadio = vi.fn();
    wrap(
      <>
        <Checkbox aria-label="Stale" onCheckedChange={onChecked} />
        <Switch aria-label="Sound" onCheckedChange={onSwitch} />
        <RadioGroup aria-label="Reference" onValueChange={onRadio}>
          <RadioGroupItem value="amsl" aria-label="AMSL" />
          <RadioGroupItem value="agl" aria-label="AGL" />
        </RadioGroup>
      </>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Stale" }));
    expect(onChecked).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("switch", { name: "Sound" }));
    expect(onSwitch).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("radio", { name: "AGL" }));
    expect(onRadio).toHaveBeenCalledWith("agl");
  });

  it("labels inputs and text areas", () => {
    wrap(
      <>
        <Label htmlFor="serial">Serial</Label>
        <Input id="serial" defaultValue="TEST-0001" />
        <Label htmlFor="reason">Reason</Label>
        <Textarea id="reason" />
      </>,
    );
    expect(
      (screen.getByLabelText("Serial") as HTMLInputElement).value,
    ).toBe("TEST-0001");
    expect(screen.getByLabelText("Reason").tagName).toBe("TEXTAREA");
  });

  it("renders separators, skeletons and a scroll area", () => {
    wrap(
      <>
        <Separator orientation="vertical" />
        <Skeleton data-testid="skeleton" />
        <ScrollArea data-testid="scroll">
          <p>Row</p>
        </ScrollArea>
      </>,
    );
    expect(
      document.querySelector('[data-slot="separator"]')?.getAttribute(
        "data-orientation",
      ),
    ).toBe("vertical");
    expect(screen.getByTestId("skeleton").dataset["slot"]).toBe("skeleton");
    expect(screen.getByText("Row")).toBeTruthy();
  });

  it("renders a table with its parts", () => {
    wrap(
      <Table>
        <TableCaption>Sources</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>TEST-RX-01</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>1</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    const table = screen.getByRole("table", { name: "Sources" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("renders breadcrumbs and pagination", () => {
    wrap(
      <>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#home">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <a href="#zones">Zones</a>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbEllipsis />
            <BreadcrumbItem>
              <BreadcrumbPage>TEST-ZONE-01</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#1" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#2" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#3" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </>,
    );
    expect(
      screen.getByRole("link", { name: "TEST-ZONE-01" }).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "2" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("link", { name: "Go to previous page" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to next page" })).toBeTruthy();
  });

  it("opens a collapsible", () => {
    wrap(
      <Collapsible>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>Hidden detail</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.queryByText("Hidden detail")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByText("Hidden detail")).toBeTruthy();
  });

  it("shows a toast in the kit's scheme", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    wrap(<Toaster />, "dark");
    act(() => {
      ui.toast("Saved");
    });
    expect(await screen.findByText("Saved")).toBeTruthy();
    expect(
      document
        .querySelector("[data-sonner-toaster]")
        ?.getAttribute("data-sonner-theme"),
    ).toBe("dark");
  });
});

describe("additions", () => {
  it("Stat shows a known value with its unit", () => {
    render(<Stat label="Height" value={87} unit="m AGL" />);
    const stat = document.querySelector('[data-slot="stat"]');
    expect(stat?.textContent).toBe("Height87m AGL");
    expect(stat?.querySelector("[data-unknown]")).toBeNull();
  });

  it("Stat shows a value without a unit", () => {
    render(<Stat label="Tracks" value={3} />);
    expect(document.querySelector('[data-slot="stat"]')?.textContent).toBe(
      "Tracks3",
    );
  });

  it("Stat shows a dash and no unit for an unknown value, never a zero", () => {
    render(<Stat label="Speed" value={null} unit="m/s" />);
    const stat = document.querySelector('[data-slot="stat"]');
    expect(stat?.textContent).toBe(`Speed${STAT_UNKNOWN}`);
    expect(stat?.textContent).not.toContain("0");
    expect(stat?.querySelector("[data-unknown]")).not.toBeNull();
  });

  it("Stat shows a zero as a zero", () => {
    render(<Stat label="Alerts" value={0} />);
    expect(document.querySelector('[data-slot="stat"]')?.textContent).toBe(
      "Alerts0",
    );
  });

  it("EmptyState says why it is empty and offers its action", () => {
    render(
      <EmptyState
        title="No alerts"
        description="No alert is open in this area."
        icon={<span>!</span>}
        action={<button type="button">Clear filters</button>}
      />,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("No alerts");
    expect(status.textContent).toContain("No alert is open in this area.");
    expect(within(status).getByRole("button", { name: "Clear filters" })).toBeTruthy();
    expect(status.querySelector('[aria-hidden="true"]')?.textContent).toBe("!");
  });

  it("EmptyState with a title only renders no empty slots", () => {
    render(<EmptyState title="Nothing" />);
    const status = screen.getByRole("status");
    expect(status.children).toHaveLength(1);
  });

  it("Kbd and InlineCode render their elements", () => {
    render(
      <p>
        <Kbd>Esc</Kbd> <InlineCode className="x">--us-focus</InlineCode>
      </p>,
    );
    expect(screen.getByText("Esc").tagName).toBe("KBD");
    const code = screen.getByText("--us-focus");
    expect(code.tagName).toBe("CODE");
    expect(code.className).toContain("x");
  });
});
