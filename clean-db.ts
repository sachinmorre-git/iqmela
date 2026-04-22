import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("Cleaning Prisma DB...");
  
  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`✅ Deleted ${deletedUsers.count} users successfully.`);

  const deletedOrgs = await prisma.department.deleteMany({});
  console.log(`✅ Deleted ${deletedOrgs.count} departments successfully.`);

  const deletedTeamInvites = await prisma.teamInvite.deleteMany({});
  console.log(`✅ Deleted ${deletedTeamInvites.count} team invites successfully.`);
  
  const deletedPositions = await prisma.position.deleteMany({});
  console.log(`✅ Deleted ${deletedPositions.count} positions successfully.`);

  console.log("Database is now clean and refreshed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
