import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export interface Props {
  url: string;
  host: string;
  theme?: "default";
}

const EmailTemplate = ({ url, host }: Props) => {
  const escapedHost = host.replace(/\./g, "&#8203;.");
  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              cyan: "#79ffe1",
              purple: "#f81ce5",
              cyberpunk: "#F2E307",
              dark: "#000000",
            },
          },
        },
      }}>
      <Html>
        <Head />
        <Body className="m-auto bg-black p-10 font-sans text-white">
          <Section
            style={{
              backgroundImage: "radial-gradient(#535353 0.5px, transparent 0)",
            }}
            className="fixed left-0 top-0 -z-10 block size-full bg-[length:11px_11px] before:content-['']"
          />
          <Container className="bg-dark/30 border-purple mx-auto my-[40px] w-[465px] rounded border border-solid p-[20px] text-white backdrop-blur-md">
            <Section className="mt-[32px]">
              <Img
                src="https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/www/icon.png"
                width="100"
                height="100"
                alt="logo"
                className="mx-auto my-0"
              />
            </Section>
            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal">
              Here's your sign-in link for <strong>{escapedHost}</strong>
            </Heading>
            <Text className="text-[14px] leading-[24px]">
              Click the button below to sign in to your account. If you didn't
              request this link, you can safely ignore this email.
            </Text>
            <Section className="my-[32px] text-center">
              <Button
                className="bg-cyberpunk rounded px-5 py-3 text-center text-[12px] font-semibold text-[#666666] no-underline"
                href={url}>
                Sign in
              </Button>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

export default EmailTemplate;
