import type { Meta } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

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
import { dark, light, type Demo, type Play } from "./story.js";

// Overlays render open so axe checks their content; the vendored close
// buttons carry English screen-reader text, so the stories pass
// `showCloseButton={false}` and render a translated close control
// (src/ui/UPGRADING.md).
const meta = { title: "ui/Overlays" } satisfies Meta;
export default meta;

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
const dialogPlay: Play = async ({ canvasElement }) => {
  await expect(body(canvasElement).getByRole("dialog")).toBeVisible();
};
export const DialogLight = light(DialogDemo, { play: dialogPlay });
export const DialogDark = dark(DialogDemo, { play: dialogPlay });

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
const alertPlay: Play = async ({ canvasElement }) => {
  await expect(body(canvasElement).getByRole("alertdialog")).toBeVisible();
};
export const AlertDialogLight = light(AlertDialogDemo, { play: alertPlay });
export const AlertDialogDark = dark(AlertDialogDemo, { play: alertPlay });

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
export const SheetLight = light(SheetDemo, { play: dialogPlay });
export const SheetDark = dark(SheetDemo, { play: dialogPlay });

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
const tooltipPlay: Play = async ({ canvasElement }) => {
  await expect(await body(canvasElement).findByRole("tooltip")).toBeTruthy();
};
export const TooltipLight = light(TooltipDemo, { play: tooltipPlay });
export const TooltipDark = dark(TooltipDemo, { play: tooltipPlay });

const PopoverDemo: Demo = (t) => (
  <Popover open>
    <PopoverTrigger asChild>
      <Button variant="outline">{t.popoverTrigger}</Button>
    </PopoverTrigger>
    <PopoverContent>{t.popoverBody}</PopoverContent>
  </Popover>
);
const popoverPlay: Play = async ({ canvasElement }) => {
  await expect(body(canvasElement).getByRole("dialog")).toBeVisible();
};
export const PopoverLight = light(PopoverDemo, { play: popoverPlay });
export const PopoverDark = dark(PopoverDemo, { play: popoverPlay });

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
const menuPlay: Play = async ({ canvasElement }) => {
  await expect(body(canvasElement).getByRole("menu")).toBeVisible();
  await expect(
    body(canvasElement).getByRole("menuitemcheckbox"),
  ).toHaveAttribute("aria-checked", "true");
};
export const DropdownMenuLight = light(DropdownMenuDemo, { play: menuPlay });
export const DropdownMenuDark = dark(DropdownMenuDemo, { play: menuPlay });

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
const commandPlay: Play = async ({ canvasElement, globals }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getAllByRole("option")).toHaveLength(2);
  // Filtering leaves the matching item only.
  const map = globals["lang"] === "ka" ? "რუკა" : "Map";
  await userEvent.type(canvas.getByRole("combobox"), map);
  await waitFor(() => expect(canvas.getAllByRole("option")).toHaveLength(1));
  await expect(canvas.getByRole("option")).toHaveTextContent(map);
};
export const CommandLight = light(CommandDemo, { play: commandPlay });
export const CommandDark = dark(CommandDemo, { play: commandPlay });

const SelectDemo: Demo = (t) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="story-select">{t.selectLabel}</Label>
    <Select defaultValue="ka">
      <SelectTrigger id="story-select" className="w-56">
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
// it. axe runs after the play, on the closed select: while the list is
// open, Radix hides the rest of the page from assistive technology,
// including the focusable trigger, which axe reports as aria-hidden-focus.
const selectPlay: Play = async ({ canvasElement, globals }) => {
  const trigger = within(canvasElement).getByRole("combobox");
  await userEvent.click(trigger);
  const options = await body(canvasElement).findAllByRole("option");
  await expect(options).toHaveLength(2);
  await expect(options[1]).toHaveAttribute("aria-selected", "true");
  await userEvent.click(options[0] as HTMLElement);
  await waitFor(() =>
    expect(body(canvasElement).queryByRole("listbox")).toBeNull(),
  );
  await expect(trigger).toHaveTextContent(
    globals["lang"] === "ka" ? "ინგლისური" : "English",
  );
};
export const SelectLight = light(SelectDemo, { play: selectPlay });
export const SelectDark = dark(SelectDemo, { play: selectPlay });

const SonnerDemo: Demo = (t) => (
  <div>
    <Toaster />
    <Button variant="outline" onClick={() => toast(t.toastText)}>
      {t.toastTrigger}
    </Button>
  </div>
);
const sonnerPlay: Play = async ({ canvasElement, globals }) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
  const text = globals["lang"] === "ka" ? "შენახულია" : "Saved";
  const toastText = await body(canvasElement).findByText(text);
  // The toast mounts transparent and fades in.
  await waitFor(() => expect(toastText).toBeVisible());
  // The toaster follows the kit's scheme, not the system preference.
  const toaster = canvasElement.ownerDocument.querySelector(
    "[data-sonner-toaster]",
  );
  await expect(toaster).toHaveAttribute(
    "data-sonner-theme",
    globals["scheme"] === "dark" ? "dark" : "light",
  );
};
export const SonnerLight = light(SonnerDemo, { play: sonnerPlay });
export const SonnerDark = dark(SonnerDemo, { play: sonnerPlay });
