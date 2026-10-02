import { waitFor, within } from "@testing-library/react";
import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "../../src/ui/index.js";
import { testDemo, type Check, type Demo } from "./demo.js";

// Overlays render open so axe checks their content; the vendored close
// buttons carry English screen-reader text, so the demos pass
// `showCloseButton={false}` and render a translated close control
// (src/ui/UPGRADING.md).
const body = (el: HTMLElement): ReturnType<typeof within> =>
  within(el.ownerDocument.body);

const DialogDemo: Demo = (t) => (
  <Dialog open>
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>{t.dialogTitle}</DialogTitle>
        <DialogDescription>{t.dialogDescription}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{t.cancel}</Button>
        </DialogClose>
        <Button>{t.save}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
const dialogCheck: Check = async (canvasElement) => {
  expect(body(canvasElement).getByRole("dialog")).toBeVisible();
};
testDemo("Dialog", DialogDemo, dialogCheck);

const AlertDialogDemo: Demo = (t) => (
  <AlertDialog open>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t.alertTitle}</AlertDialogTitle>
        <AlertDialogDescription>{t.alertDescription}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
        <AlertDialogAction>{t.save}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
const alertCheck: Check = async (canvasElement) => {
  expect(body(canvasElement).getByRole("alertdialog")).toBeVisible();
};
testDemo("AlertDialog", AlertDialogDemo, alertCheck);

const SheetDemo: Demo = (t) => (
  <Sheet open>
    <SheetContent showCloseButton={false}>
      <SheetHeader>
        <SheetTitle>{t.sheetTitle}</SheetTitle>
        <SheetDescription>{t.sheetDescription}</SheetDescription>
      </SheetHeader>
      <div className="p-4">
        <SheetClose asChild>
          <Button variant="outline">{t.close}</Button>
        </SheetClose>
      </div>
    </SheetContent>
  </Sheet>
);
testDemo("Sheet", SheetDemo, dialogCheck);

const TooltipDemo: Demo = (t) => (
  <div className="pt-12">
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="outline">{t.tooltipTrigger}</Button>
      </TooltipTrigger>
      <TooltipContent>{t.tooltip}</TooltipContent>
    </Tooltip>
  </div>
);
const tooltipCheck: Check = async (canvasElement) => {
  expect(await body(canvasElement).findByRole("tooltip")).toBeTruthy();
};
testDemo("Tooltip", TooltipDemo, tooltipCheck);

const PopoverDemo: Demo = (t) => (
  <Popover open>
    <PopoverTrigger asChild>
      <Button variant="outline">{t.popoverTrigger}</Button>
    </PopoverTrigger>
    <PopoverContent>{t.popoverBody}</PopoverContent>
  </Popover>
);
const popoverCheck: Check = async (canvasElement) => {
  expect(body(canvasElement).getByRole("dialog")).toBeVisible();
};
testDemo("Popover", PopoverDemo, popoverCheck);

const DropdownMenuDemo: Demo = (t) => (
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">{t.menuTrigger}</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuLabel>{t.menuLabel}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>{t.menuItemOne}</DropdownMenuItem>
      <DropdownMenuItem>{t.menuItemTwo}</DropdownMenuItem>
      <DropdownMenuCheckboxItem checked>
        {t.menuChecked}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
const menuCheck: Check = async (canvasElement) => {
  expect(body(canvasElement).getByRole("menu")).toBeVisible();
  expect(body(canvasElement).getByRole("menuitemcheckbox")).toHaveAttribute(
    "aria-checked",
    "true",
  );
};
testDemo("DropdownMenu", DropdownMenuDemo, menuCheck);

const CommandDemo: Demo = (t) => (
  <Command className="max-w-sm rounded-lg border" label={t.commandGroup}>
    <CommandInput
      placeholder={t.commandPlaceholder}
      aria-label={t.commandPlaceholder}
    />
    <CommandList>
      <CommandEmpty>{t.commandEmpty}</CommandEmpty>
      <CommandGroup heading={t.commandGroup}>
        <CommandItem>{t.commandItemOne}</CommandItem>
        <CommandItem>{t.commandItemTwo}</CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);
const commandCheck: Check = async (canvasElement, look) => {
  const canvas = within(canvasElement);
  expect(canvas.getAllByRole("option")).toHaveLength(2);
  // Filtering leaves the matching item only.
  const map = look.lang === "ka" ? "რუკა" : "Map";
  await userEvent.type(canvas.getByRole("combobox"), map);
  await waitFor(() => expect(canvas.getAllByRole("option")).toHaveLength(1));
  expect(canvas.getByRole("option")).toHaveTextContent(map);
};
testDemo("Command", CommandDemo, commandCheck);

const SelectDemo: Demo = (t) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="demo-select">{t.selectLabel}</Label>
    <Select defaultValue="ka">
      <SelectTrigger id="demo-select" className="w-56">
        <SelectValue placeholder={t.selectPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">{t.selectEn}</SelectItem>
        <SelectItem value="ka">{t.selectKa}</SelectItem>
      </SelectContent>
    </Select>
  </div>
);
// Opens the list, picks the other language and checks the trigger shows
// it. axe runs after the check, on the closed select: while the list is
// open, Radix hides the rest of the page from assistive technology,
// including the focusable trigger, which axe reports as aria-hidden-focus.
const selectCheck: Check = async (canvasElement, look) => {
  const trigger = within(canvasElement).getByRole("combobox");
  await userEvent.click(trigger);
  const options = await body(canvasElement).findAllByRole("option");
  expect(options).toHaveLength(2);
  expect(options[1]).toHaveAttribute("aria-selected", "true");
  await userEvent.click(options[0] as HTMLElement);
  await waitFor(() =>
    expect(body(canvasElement).queryByRole("listbox")).toBeNull(),
  );
  expect(trigger).toHaveTextContent(
    look.lang === "ka" ? "ინგლისური" : "English",
  );
};
testDemo("Select", SelectDemo, selectCheck);

const SonnerDemo: Demo = (t) => (
  <div>
    <Toaster />
    <Button variant="outline" onClick={() => toast(t.toastText)}>
      {t.toastTrigger}
    </Button>
  </div>
);
const sonnerCheck: Check = async (canvasElement, look) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
  const text = look.lang === "ka" ? "შენახულია" : "Saved";
  const toastText = await body(canvasElement).findByText(text);
  // The toast mounts transparent and fades in.
  await waitFor(() => expect(toastText).toBeVisible());
  // The toaster follows the kit's scheme, not the system preference.
  const toaster = canvasElement.ownerDocument.querySelector(
    "[data-sonner-toaster]",
  );
  expect(toaster).toHaveAttribute(
    "data-sonner-theme",
    look.scheme === "dark" ? "dark" : "light",
  );
};
testDemo("Sonner", SonnerDemo, sonnerCheck);
