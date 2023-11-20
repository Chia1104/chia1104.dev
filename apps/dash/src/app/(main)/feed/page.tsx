import FeedList from "./feed-list";

const FeedPage = async () => {
  return (
    <div className="c-container main mt-24">
      <FeedList query={{ limit: 10 }} />
    </div>
  );
};

export default FeedPage;
