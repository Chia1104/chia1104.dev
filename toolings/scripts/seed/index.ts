import { prisma } from "@chia/db";
import { faker } from "@faker-js/faker";
import "dotenv/config";

async function main() {
  void (await prisma.post.create({
    data: {
      slug: faker.lorem.slug(),
      title: faker.lorem.sentence(),
      excerpt: faker.lorem.paragraph(),
      content: faker.lorem.paragraphs(),
      published: true,
      userId: process.env.CHIA_ID ?? "",
    },
  }));
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
