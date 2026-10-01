// `@rootxkit/uspace-ui/ui` (docs/PLAN.md §3.3, D5, WP-1): the vendored
// shadcn/ui set, exported unchanged in name and props so the upstream
// documentation applies, plus `cn()` and the kit's additions. The vendored
// files are the CLI's output with only their import paths changed;
// src/ui/UPGRADING.md is the procedure.
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog.js";
export { Badge, badgeVariants } from "./badge.js";
export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb.js";
export { Button, buttonVariants } from "./button.js";
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card.js";
export { Checkbox } from "./checkbox.js";
export { cn } from "./cn.js";
export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible.js";
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command.js";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./dialog.js";
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";
export * from "./extra/index.js";
export { Input } from "./input.js";
export { Label } from "./label.js";
export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination.js";
export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover.js";
export { RadioGroup, RadioGroupItem } from "./radio-group.js";
export { ScrollArea, ScrollBar } from "./scroll-area.js";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select.js";
export { Separator } from "./separator.js";
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet.js";
export { Skeleton } from "./skeleton.js";
export { Textarea } from "./textarea.js";
export { Toaster } from "./sonner.js";
// The function that raises a toast, from the same sonner copy the Toaster
// listens on.
export { toast } from "sonner";
export { Switch } from "./switch.js";
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table.js";
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  tabsListVariants,
} from "./tabs.js";
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip.js";
