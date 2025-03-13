const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <article className="c-container main justify-start items-start">
      {children}
    </article>
  );
};

export default Layout;
