import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
  Markdown,
} from "@react-email/components";

export interface Props {
  title?: string;
  message?: string;
  email?: string;
  ip?: string;
  emailConfig?: {
    preview?: string;
    title?: string;
  };
}

const EmailTemplate = ({ title, message, email, ip, emailConfig }: Props) => {
  const previewText =
    emailConfig?.preview ?? `You have received a message from ${email}`;

  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-white">
          <Preview>{previewText}</Preview>
          <Container className="mx-auto my-0 max-w-2xl bg-[url('https://storage.chia1104.dev/project-background.jpg')] [background-position:bottom] [background-repeat:no-repeat] p-6">
            <Section className="rounded-2xl bg-white p-4">
              <Img
                src="https://storage.chia1104.dev/bot-example.png"
                width={48}
                height={48}
                alt="Chia1104.dev"
              />
              <Heading className="mt-12 text-[28px] font-bold">
                {emailConfig?.title ?? "Contact Message"}
              </Heading>
              <Text className="text-base leading-6.5">{previewText}</Text>
              {title && (
                <Section className="mx-0 my-6">
                  <Text className="text-lg leading-3">{title}</Text>
                </Section>
              )}
              <Markdown>{message ?? ""}</Markdown>
              <Hr className="mt-12 border-[#dddddd]" />
              <Img
                src="https://storage.chia1104.dev/bot-example.png"
                width={32}
                height={32}
                style={{
                  WebkitFilter: "grayscale(100%)",
                }}
                className="mx-0 my-5 [filter:grayscale(100%)]"
              />
              <Text className="ml-1 text-xs leading-6 text-[#8898aa]">
                Chia1104.dev
              </Text>
              <Text className="ml-1 text-xs leading-6 text-[#8898aa]">
                The message was sent from the IP address: {ip ?? "Unknown"}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailTemplate;
