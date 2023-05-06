import Background from "./background";
import GoHome from "./go-home";

const NotFound = () => {
  return (
    <div className="c-container main">
      <Background />
      <div className="flex w-[300px] flex-col gap-3">
        <h2 className="text-start text-3xl">404</h2>
        <p className="mb-10 text-start text-xl">
          The page you are looking for does not exist.
        </p>
        <GoHome />
      </div>
    </div>
  );
};

export default NotFound;
