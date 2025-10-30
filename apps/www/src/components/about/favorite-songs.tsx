import CurrentPlaying from "@/components/commons/current-playing";

export const FavoriteSongs = () => {
  return (
    <>
      <h2>Favorite Songs</h2>
      <p>Currently, I'm listening to this song.</p>
      <CurrentPlaying
        className="mb-5"
        experimental={{
          displayBackgroundColorFromImage: true,
        }}
      />
    </>
  );
};
