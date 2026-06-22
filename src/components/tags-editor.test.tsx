import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tag } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { TagsEditor } from "./tags-editor";

describe("TagsEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds a row, fills it, and calls onSave with the new tag and no removals", async () => {
    const onSave = vi.fn();
    const { user } = renderWithProviders(<TagsEditor current={[]} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: /Add/ }));
    await user.type(screen.getByPlaceholderText("Key"), "Env");
    await user.type(screen.getByPlaceholderText("Value"), "prod");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([{ key: "Env", value: "prod" }], []);
  });

  it("edits an existing tag value and reports no removed keys", async () => {
    const current: Tag[] = [{ key: "Env", value: "dev" }];
    const onSave = vi.fn();
    const { user } = renderWithProviders(<TagsEditor current={current} onSave={onSave} />);

    const value = screen.getByPlaceholderText("Value");
    await user.clear(value);
    await user.type(value, "prod");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith([{ key: "Env", value: "prod" }], []);
  });

  it("removing a row reports it in removedKeys", async () => {
    const current: Tag[] = [
      { key: "Env", value: "prod" },
      { key: "Team", value: "infra" },
    ];
    const onSave = vi.fn();
    const { user } = renderWithProviders(<TagsEditor current={current} onSave={onSave} />);

    // Two delete buttons (one per row); remove the first (Env).
    const [del] = screen.getAllByTitle("Delete");
    if (!del) throw new Error("no delete button");
    await user.click(del);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith([{ key: "Team", value: "infra" }], ["Env"]);
  });
});
