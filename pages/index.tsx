import type { NextPage } from 'next'
import Head from 'next/head'
import styles from '../styles/EntryPage.module.css'

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Chia WEB</title>
        <meta name="description" content="Yu Yu, Chia, 俞又嘉, WEB developer, UI/UX " />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          CHIA WEB
        </h1>
      </main>

      <footer className={styles.footer}>
        <p>
          @copyright 2022 Chia WEB
        </p>
      </footer>
    </div>
  )
}

export default Home
