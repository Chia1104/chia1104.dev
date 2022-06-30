import type { NextPage } from 'next'
import { Layout } from "@chia/components/globals/Layout";
import LoginCard from "@chia/components/pages/login/LoginCard";

const LoginPage: NextPage = () => {
    return (
        <Layout title={'Login'} description={'Login'}>
            <article className="main c-container mt-20">
                <LoginCard />
            </article>
        </Layout>
    )
}

export default LoginPage
