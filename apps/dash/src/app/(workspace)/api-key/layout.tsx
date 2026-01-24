const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <article className="main container items-start justify-start">
      {children}
    </article>
  );
};

export default Layout;
