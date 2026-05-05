import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const data = await prisma.clientVendorRelation.findMany({ include: { vendorOrg: true } })
  console.log(JSON.stringify(data, null, 2))
}
main().finally(() => prisma.$disconnect())
