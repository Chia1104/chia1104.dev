import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NavigationGuard } from "../src/libs/navigation-guard";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const { useGuardedRouter, useNavigationGuard } =
  await import("../src/libs/navigation-guard");

const Guarded = ({ guard }: { guard: NavigationGuard }) => {
  useNavigationGuard(guard);
  // A plain anchor on purpose: the guard has to catch links that bypass `next/link`.
  // oxlint-disable-next-line next/no-html-link-for-pages
  return <a href="/feed/drafts">Drafts</a>;
};

const Nav = ({ href }: { href: string }) => {
  const router = useGuardedRouter();
  return <button onClick={() => router.push(href)}>Go</button>;
};

describe("navigation guard", () => {
  beforeEach(() => navigation.push.mockReset());

  it("pushes at once without a guard", () => {
    render(<Nav href="/settings" />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(navigation.push).toHaveBeenCalledWith("/settings");
  });

  it("never asks for a query change on the same pathname", () => {
    const guard = vi.fn<NavigationGuard>().mockResolvedValue(false);
    render(
      <>
        <Guarded guard={guard} />
        <Nav href="/?agent=open" />
      </>
    );
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(guard).not.toHaveBeenCalled();
    expect(navigation.push).toHaveBeenCalledWith("/?agent=open");
  });

  it("asks the guard before leaving and pushes only when allowed", async () => {
    const guard = vi.fn<NavigationGuard>().mockResolvedValue(false);
    render(
      <>
        <Guarded guard={guard} />
        <Nav href="/settings" />
      </>
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Go" }));
    });
    expect(guard).toHaveBeenCalledWith("/settings");
    expect(navigation.push).not.toHaveBeenCalled();

    guard.mockResolvedValue(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Go" }));
    });
    expect(navigation.push).toHaveBeenCalledWith("/settings");
  });

  it("routes plain anchor clicks through the guard, except modified clicks", async () => {
    const guard = vi.fn<NavigationGuard>().mockResolvedValue(true);
    render(<Guarded guard={guard} />);
    const anchor = screen.getByRole("link", { name: "Drafts" });

    // Left to the default, jsdom would follow the link and move the test off the page.
    document.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(anchor, { metaKey: true });
    expect(guard).not.toHaveBeenCalled();

    let prevented = false;
    await act(async () => {
      prevented = !fireEvent.click(anchor);
    });
    expect(prevented).toBe(true);
    expect(guard).toHaveBeenCalledWith("http://localhost:3000/feed/drafts");
    expect(navigation.push).toHaveBeenCalledWith("/feed/drafts");
  });

  it("releases the guard on unmount", () => {
    const guard = vi.fn<NavigationGuard>().mockResolvedValue(false);
    const { unmount } = render(<Guarded guard={guard} />);
    unmount();
    render(<Nav href="/settings" />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(guard).not.toHaveBeenCalled();
    expect(navigation.push).toHaveBeenCalledWith("/settings");
  });
});
