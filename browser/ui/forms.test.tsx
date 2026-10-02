import { within } from "@testing-library/react";
import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import {
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Textarea,
} from "../../src/ui/index.js";
import { testDemo, type Check, type Demo } from "./demo.js";

const CheckboxDemo: Demo = (t) => (
  <div className="flex items-center gap-2">
    <Checkbox id="demo-checkbox" />
    <Label htmlFor="demo-checkbox">{t.checkbox}</Label>
  </div>
);
const checkboxCheck: Check = async (canvasElement) => {
  const box = within(canvasElement).getByRole("checkbox");
  expect(box).toHaveAttribute("aria-checked", "false");
  await userEvent.click(box);
  expect(box).toHaveAttribute("aria-checked", "true");
};
testDemo("Checkbox", CheckboxDemo, checkboxCheck);

const RadioGroupDemo: Demo = (t) => (
  <RadioGroup defaultValue="amsl" aria-label={t.radioLabel}>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="amsl" id="demo-amsl" />
      <Label htmlFor="demo-amsl">{t.radioAmsl}</Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="agl" id="demo-agl" />
      <Label htmlFor="demo-agl">{t.radioAgl}</Label>
    </div>
  </RadioGroup>
);
testDemo("RadioGroup", RadioGroupDemo);

const SwitchDemo: Demo = (t) => (
  <div className="flex items-center gap-2">
    <Switch id="demo-switch" defaultChecked />
    <Label htmlFor="demo-switch">{t.switchLabel}</Label>
  </div>
);
testDemo("Switch", SwitchDemo);

const InputDemo: Demo = (t) => (
  <div className="flex max-w-sm flex-col gap-2">
    <Label htmlFor="demo-input">{t.inputLabel}</Label>
    <Input id="demo-input" placeholder={t.inputPlaceholder} />
    <Input aria-label={t.inputLabel} aria-invalid defaultValue="TEST-?" />
    <Input aria-label={t.inputLabel} disabled defaultValue="TEST-0002" />
  </div>
);
testDemo("Input", InputDemo);

const TextareaDemo: Demo = (t) => (
  <div className="flex max-w-sm flex-col gap-2">
    <Label htmlFor="demo-textarea">{t.textareaLabel}</Label>
    <Textarea id="demo-textarea" placeholder={t.textareaPlaceholder} />
  </div>
);
testDemo("Textarea", TextareaDemo);

const LabelDemo: Demo = (t) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="demo-label">{t.inputLabel}</Label>
    <Input id="demo-label" />
  </div>
);
testDemo("Label", LabelDemo);
