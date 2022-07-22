import type { NextPage } from "next";
import { Layout } from "@chia/components/globals/Layout";
import { Chia } from "@chia/utils/meta/chia";

const DashboardPage: NextPage = () => {
  const name = Chia.name;

  return (
    <Layout title={`Hello ${name}`} description={`Hello ${name}`}>
      <article className="main c-container mt-20">
        <h1>Dashboard</h1>
      </article>
    </Layout>
  );
};

export default DashboardPage;
