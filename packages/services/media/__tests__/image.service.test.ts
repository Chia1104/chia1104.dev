import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaSource } from "@chia/db/types";

import { MediaImageRole, storeMediaImage } from "../image.service";

const { uploadObject } = vi.hoisted(() => ({ uploadObject: vi.fn() }));

vi.mock("@chia/integrations/s3/service", () => ({
  s3Service: { uploadObject },
}));

const store = (url: string) =>
  storeMediaImage(MediaSource.Anilist, "154587", MediaImageRole.Poster, url);

describe("storeMediaImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    uploadObject.mockReset();
  });

  it("refuses a URL outside the catalogue CDNs without fetching it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(store("https://169.254.169.254/latest")).rejects.toThrow(
      "not a catalogue CDN"
    );
    await expect(store("http://s4.anilist.co/cover.jpg")).rejects.toThrow(
      "not a catalogue CDN"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores a catalogue image under a key derived from the work, refusing redirects", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg" },
      })
    );

    const stored = await store("https://s4.anilist.co/cover.jpg");

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
    expect(stored.key).toBe("media/anilist-154587-poster.jpg");
    expect(uploadObject).toHaveBeenCalledWith(
      "media/anilist-154587-poster.jpg",
      new Uint8Array([1, 2, 3]),
      "image/jpeg"
    );
  });

  it("drops a body that is not an image or declares more than the cap", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html>", { headers: { "content-type": "text/html" } })
    );
    await expect(store("https://s4.anilist.co/cover.jpg")).rejects.toThrow(
      "unsupported type"
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array(1), {
        headers: {
          "content-type": "image/png",
          "content-length": String(64 * 1024 * 1024),
        },
      })
    );
    await expect(store("https://s4.anilist.co/cover.jpg")).rejects.toThrow(
      "larger than the cap"
    );
    expect(uploadObject).not.toHaveBeenCalled();
  });
});
