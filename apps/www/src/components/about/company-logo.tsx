import Image from "next/image";

import { Company } from "@chia/meta";

const LOGO_SIZE = 24;

/** Wiwynn's mark without the wordmark; the white strokes follow the text color so it reads in both themes. */
const WiwynnLogo = () => (
  <svg
    viewBox="5.6 -0.2 144 144"
    width={LOGO_SIZE}
    height={LOGO_SIZE}
    role="img"
    aria-label="Wiwynn">
    <g fill="currentColor">
      <path d="M81.606,39.44c-1.246-8.168-10.123-8.785-10.123-8.785H59.037l8.325,54.83l16.763-29.553L81.606,39.44z" />
      <path d="M47.938,39.44c-1.247-8.168-10.124-8.785-10.124-8.785H25.368l8.012,52.771h0.002c0,0,1.332,8.785,10.117,8.785h12.492L47.938,39.44z" />
      <path d="M14.351,103.901c9.317,9.539,24.928,13.348,42.592,11.787l7.674-13.533c-17.474,2.709-33.064-0.197-41.67-9.152c-9.287-9.674-8.285-24.166,0.818-38.506l-1.297-8.543C4.56,66.502,0.386,89.59,14.351,103.901z" />
      <path d="M118.075,7.891c-21.24-3.822-49.617,2.885-73.941,19.211c1.484,0.68,2.971,1.609,4.307,2.828c0.84-0.572,1.688-1.141,2.557-1.703c21.671-13.973,46.586-19.67,64.777-16.277c1.781,0.334,3.492,0.762,5.135,1.268l2.338-4.119C121.571,8.629,119.857,8.211,118.075,7.891z" />
      <path d="M141.406,19.581l-3.511,6.189c0.996,1.756,1.752,3.607,2.253,5.547c3.933,15.238-7.198,35.625-29.147,51.393l-11.232,19.807c3.848-2.039,7.643-4.283,11.34-6.768c32.268-21.656,46.076-52.627,33.426-72.166C143.63,22.186,142.579,20.856,141.406,19.581z" />
    </g>
    <path
      fill="#8ED300"
      d="M140.87,18.971c-4.537-4.648-10.59-7.904-17.623-9.873l-2.338,4.119l-70.086,123.58h24.103l62.97-111.027l3.511-6.189C141.222,19.381,141.062,19.168,140.87,18.971z"
    />
  </svg>
);

/** Returns `null` for entries without a logo so the timeline leaves no empty slot. */
export const getCompanyLogo = (company?: Company) => {
  switch (company) {
    case Company.Wiwynn:
      return <WiwynnLogo />;
    case Company.LeadBest:
      return (
        <Image
          src="/assets/companies/leadbest.jpg"
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          alt="LeadBest"
          className="rounded-sm"
        />
      );
    case Company.Wanin:
      return (
        <Image
          src="/assets/companies/wanin.png"
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          alt="WANIN"
        />
      );
    default:
      return null;
  }
};
