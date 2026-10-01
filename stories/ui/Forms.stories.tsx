import type { Meta } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Textarea,
} from "../../src/ui/index.js";
import { dark, light, type Demo, type Play } from "./story.js";

const meta = { title: "ui/Forms" } satisfies Meta;
export default meta;

const CheckboxDemo: Demo = (t) => (
  <div className="flex items-center gap-2">
    <Checkbox id="story-checkbox" />
    <Label htmlFor="story-checkbox">{t.checkbox}</Label>
  </div>
);
const checkboxPlay: Play = async ({ canvasElement }) => {
  const box = within(canvasElement).getByRole("checkbox");
  await expect(box).toHaveAttribute("aria-checked", "false");
  await userEvent.click(box);
  await expect(box).toHaveAttribute("aria-checked", "true");
};
export const CheckboxLight = light(CheckboxDemo, { play: checkboxPlay });
export const CheckboxDark = dark(CheckboxDemo, { play: checkboxPlay });

const RadioGroupDemo: Demo = (t) => (
  <RadioGroup defaultValue="amsl" aria-label={t.radioLabel}>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="amsl" id="story-amsl" />
      <Label htmlFor="story-amsl">{t.radioAmsl}</Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="agl" id="story-agl" />
      <Label htmlFor="story-agl">{t.radioAgl}</Label>
    </div>
  </RadioGroup>
);
export const RadioGroupLight = light(RadioGroupDemo);
export const RadioGroupDark = dark(RadioGroupDemo);

const SwitchDemo: Demo = (t) => (
  <div className="flex items-center gap-2">
    <Switch id="story-switch" defaultChecked />
    <Label htmlFor="story-switch">{t.switchLabel}</Label>
  </div>
);
export const SwitchLight = light(SwitchDemo);
export const SwitchDark = dark(SwitchDemo);

const InputDemo: Demo = (t) => (
  <div className="flex max-w-sm flex-col gap-2">
    <Label htmlFor="story-input">{t.inputLabel}</Label>
    <Input id="story-input" placeholder={t.inputPlaceholder} />
    <Input aria-label={t.inputLabel} aria-invalid defaultValue="TEST-?" />
    <Input aria-label={t.inputLabel} disabled defaultValue="TEST-0002" />
  </div>
);
export const InputLight = light(InputDemo);
export const InputDark = dark(InputDemo);

const TextareaDemo: Demo = (t) => (
  <div className="flex max-w-sm flex-col gap-2">
    <Label htmlFor="story-textarea">{t.textareaLabel}</Label>
    <Textarea id="story-textarea" placeholder={t.textareaPlaceholder} />
  </div>
);
export const TextareaLight = light(TextareaDemo);
export const TextareaDark = dark(TextareaDemo);

const LabelDemo: Demo = (t) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="story-label">{t.inputLabel}</Label>
    <Input id="story-label" />
  </div>
);
export const LabelLight = light(LabelDemo);
export const LabelDark = dark(LabelDemo);
