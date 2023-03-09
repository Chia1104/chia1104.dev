import { Editor } from "./components";
import "highlight.js/styles/atom-one-dark-reasonable.css";

const NewPostPage = () => {
  return (
    <div className="h-screen w-screen">
      <Editor />
    </div>
  );
};

export default NewPostPage;
