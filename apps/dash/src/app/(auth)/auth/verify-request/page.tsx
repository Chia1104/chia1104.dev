import { Provider } from "@chia/auth-core/types";
import { Card } from "@chia/ui";

const Page = ({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) => {
  const provider = searchParams.provider;
  const type = searchParams.type;
  switch (provider) {
    default:
    case Provider.resend:
      return (
        <div className="c-container main prose dark:prose-invert">
          <Card
            wrapperProps={{
              className: "w-full max-w-[500px]",
            }}
            className="prose dark:prose-invert flex w-full max-w-[500px] flex-col items-center justify-center px-1 py-12 sm:px-4">
            <h2>Check your email</h2>
            <p>A sign in link has been sent to your email address.</p>
          </Card>
        </div>
      );
  }
};

export default Page;
