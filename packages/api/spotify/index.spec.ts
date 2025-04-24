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
      fails:
        process.env.APP_CODE !== "service" && process.env.NODE_ENV === "test",
    },
    async () => {
      const result = await getPlayList({
        playlistId: "4cPPG7mh2a8EZ2jlhJfj9u",
      });
      expect(result).toBeDefined();
    }
  );

  test(
    "getPlayList",
    {
      retry: 3,
      fails: true,
    },
    async () => {
      const result = await getPlayList({
        playlistId: "37i9dQZF1Epyg7jBW9q502",
      });
      expect(result).toBeDefined();
    }
  );

  test(
    "getNowPlaying",
    {
      retry: 3,
      fails:
        process.env.APP_CODE !== "service" && process.env.NODE_ENV === "test",
    },
    async () => {
      const result = await getNowPlaying();
      expect(result).toBeDefined();
    }
  );
});
