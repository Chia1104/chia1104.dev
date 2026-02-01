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
  Button,
} from "@react-email/components";

export interface Props {
  url?: string;
}

const AuthEmailTemplate = ({ url }: Props) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-white">
          <Preview>Please click the link below to sign in</Preview>
          <Container className="mx-auto my-0 max-w-2xl bg-[url('https://storage.chia1104.dev/project-background.jpg')] [background-position:bottom] [background-repeat:no-repeat] p-6">
            <Section className="rounded-2xl bg-white p-4">
              <Img
                src="https://storage.chia1104.dev/bot-example.png"
                width={48}
                height={48}
                alt="Chia1104.dev"
              />
              <Heading className="mt-12 text-[28px] font-bold">
                Sign in to Chia1104.dev
              </Heading>
              <Text className="text-base leading-6.5">
                Please click the link below to sign in
              </Text>
              <Button href={url}>Sign in</Button>
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
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default AuthEmailTemplate;
