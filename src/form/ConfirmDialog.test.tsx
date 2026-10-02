// ConfirmDialog (WP-10, PLAN §3.15): onConfirm is not called without the
// required reason and is called with it (pair); a reason shorter than the
// caller's minimum is refused; Escape cancels; focus returns to the
// opener; the destructive variant does not focus its confirm button,
// while a plain one without a reason does (pair); axe in both languages.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import { axeCheck } from "../test/axe.js";
import { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog.js";

afterEach(() => {
  cleanup();
});

const CATALOGUES = {
  en: {
    "t.switch_title": "Switch off {name}",
    "t.switch_body":
      "No positions from {name} will be shown until it is switched on.",
    "t.open": "Switch off",
  },
  ka: {
    "t.switch_title": "{name}: გათიშვა",
    "t.switch_body": "{name}-ის პოზიციები არ გამოჩნდება ჩართვამდე.",
    "t.open": "გათიშვა",
  },
};

type Props = Partial<ConfirmDialogProps> & { lang?: Lang };

function renderDialog(props: Props = {}) {
  const { lang = "en", ...rest } = props;
  const onConfirm = rest.onConfirm ?? vi.fn();
  const onCancel = rest.onCancel ?? vi.fn();
  const view = render(
    <I18nProvider lang={lang} catalogues={CATALOGUES}>
      <ConfirmDialog
        titleKey="t.switch_title"
        bodyKey="t.switch_body"
        vars={{ name: "rx-test-01" }}
        trigger={
          <button type="button">
            {lang === "en" ? "Switch off" : "გათიშვა"}
          </button>
        }
        {...rest}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </I18nProvider>,
  );
  return { ...view, onConfirm, onCancel };
}

function open(name = "Switch off") {
  const opener = screen.getByRole("button", { name });
  act(() => {
    opener.focus();
  });
  fireEvent.click(opener);
  return opener;
}

const dialog = () => screen.getByRole("alertdialog");
const confirmButton = () => screen.getByRole("button", { name: "Confirm" });

describe("ConfirmDialog", () => {
  it("does not confirm without the required reason, and confirms with it (pair)", () => {
    const { onConfirm } = renderDialog({
      reason: { required: true, minLength: 10 },
    });
    open();
    expect(dialog().textContent).toMatch(/Switch off rx-test-01/);
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Required");
    fireEvent.change(screen.getByLabelText(/^Reason/), {
      target: { value: "too short" },
    });
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "The reason is too short",
    );
    fireEvent.change(screen.getByLabelText(/^Reason/), {
      target: { value: "  receiver maintenance  " },
    });
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("receiver maintenance");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("confirms without a reason when none is asked, with nothing passed", () => {
    const { onConfirm } = renderDialog();
    open();
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it("cancels on Escape and returns focus to the opener", async () => {
    const { onConfirm, onCancel } = renderDialog({
      reason: { required: true, minLength: 3 },
    });
    const opener = open();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Reason/));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    // Radix restores focus on the next tick after the dialog unmounts.
    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });

  it("cancels from the Cancel button too, and starts the next opening empty", () => {
    const { onCancel } = renderDialog({
      reason: { required: true, minLength: 3 },
    });
    open();
    fireEvent.change(screen.getByLabelText(/^Reason/), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    open();
    expect(
      (screen.getByLabelText(/^Reason/) as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("does not focus the confirm button of a destructive act; a plain one does (pair)", () => {
    renderDialog({ destructive: true });
    open();
    expect(document.activeElement).not.toBe(confirmButton());
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
    expect(dialog().getAttribute("data-destructive")).toBe("true");
    // A stray Enter on the focused element does not confirm.
    cleanup();
    const plain = renderDialog();
    open();
    expect(document.activeElement).toBe(confirmButton());
    expect(plain.onConfirm).not.toHaveBeenCalled();
  });

  it("works controlled, without a trigger", () => {
    const onConfirm = vi.fn();
    function Host() {
      const [isOpen, setOpen] = useState(false);
      return (
        <I18nProvider lang="en" catalogues={CATALOGUES}>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            open it
          </button>
          <ConfirmDialog
            titleKey="t.switch_title"
            bodyKey="t.switch_body"
            vars={{ name: "rx-test-02" }}
            open={isOpen}
            onOpenChange={setOpen}
            onConfirm={onConfirm}
          />
        </I18nProvider>
      );
    }
    render(<Host />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "open it" }));
    expect(dialog().textContent).toMatch(/rx-test-02/);
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it.each(["en", "ka"] as const)(
    "is axe-clean with a reason, %s",
    async (lang) => {
      renderDialog({
        lang,
        reason: { required: true, minLength: 10 },
        destructive: true,
      });
      open(lang === "en" ? "Switch off" : "გათიშვა");
      await axeCheck(document.body);
      expect(dialog().textContent).toMatch(lang === "en" ? /Reason/ : /მიზეზი/);
    },
  );
});
