import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export interface Props {
  title?: string;
  message?: string;
  email?: string;
  ip?: string;
}

const EmailTemplate = ({ title = "Untitled", message, email, ip }: Props) => {
  const previewText = `You have received a message from ${email}`;
  const fromEmail = `mailto:${email}`;
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
        <Preview>{previewText}</Preview>
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
                src="https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/www/contact.PNG"
                width="100"
                height="100"
                alt="Contact me"
                className="mx-auto my-0"
              />
            </Section>
            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal">
              <strong>{title}</strong>
            </Heading>
            <Text className="text-[14px] leading-[24px]">
              From:{" "}
              <Link href={fromEmail} className="text-cyan no-underline">
                {email}
              </Link>
            </Text>
            <Text className="text-[14px] leading-[24px]">{message}</Text>
            <Section className="my-[32px] text-center">
              <Button
                className="bg-cyberpunk rounded px-5 py-3 text-center text-[12px] font-semibold text-[#666666] no-underline"
                href={fromEmail}>
                Reply
              </Button>
            </Section>
            <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
            <Text className="text-[12px] leading-[24px] text-[#666666]">
              The message was sent from IP address {ip}
            </Text>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

export default EmailTemplate;
