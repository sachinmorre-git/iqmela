import { prisma } from './src/lib/prisma'

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, organizationId: true, isDeleted: true } })
  console.log("Users:", users)
  const experts = await prisma.interviewerProfile.findMany({ include: { user: true } })
  console.log("Experts:", experts)
}
main().catch(console.error)
