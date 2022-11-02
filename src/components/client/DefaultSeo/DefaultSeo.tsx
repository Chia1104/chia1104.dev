"use client";

import { DefaultSeo as DSEO } from "next-seo";
import SEO from "../../../../next-seo.config";

const DefaultSeo = () => {
  return <DSEO {...SEO} />;
};

export default DefaultSeo;
