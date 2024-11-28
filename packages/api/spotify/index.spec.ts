import { getPlayList, getNowPlaying } from ".";

vi.mock("server-only", () => {
  return {
    // mock server-only module
  };
});

describe("test spotify api", () => {
  test(
    "getPlayList",
    {
      retry: 3,
    },
    async () => {
      const result = await getPlayList({
        playlistId: "4cPPG7mh2a8EZ2jlhJfj9u",
      });
      expect(result).toBeDefined();
    }
  );

  test(
    "getNowPlaying",
    {
      retry: 3,
    },
    async () => {
      const result = await getNowPlaying();
      expect(result).toBeDefined();
    }
  );
});
