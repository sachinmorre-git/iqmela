import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const { createClerkClient } = require("@clerk/backend");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const usersToCreate = [
  { email: "org1_admin@org1.com", roles: ["ORG_ADMIN"], depts: [] },
  { email: "org1_dept_admin@org1.com", roles: ["DEPT_ADMIN"], depts: ["ALL"] },
  { email: "org1_dept1_admin@org1.com", roles: ["DEPT_ADMIN"], depts: ["IT", "Data Eng"] },
  { email: "org1_dept2_admin@org1.com", roles: ["DEPT_ADMIN"], depts: ["UX", "DevOps"] },
  { email: "org1_recruiter@org1.com", roles: ["RECRUITER"], depts: ["ALL"] },
  { email: "org1_recruiter1@org1.com", roles: ["RECRUITER"], depts: ["IT", "Data Eng"] },
  { email: "org1_recruiter2@org1.com", roles: ["RECRUITER"], depts: ["UX", "DevOps"] },
  { email: "org1_hiring_manager@org1.com", roles: ["HIRING_MANAGER"], depts: ["ALL"] },
  { email: "org1_hiring_manager1@org1.com", roles: ["HIRING_MANAGER"], depts: ["IT", "Data Eng"] },
  { email: "org1_hiring_manager2@org1.com", roles: ["HIRING_MANAGER"], depts: ["UX", "DevOps"] },
  { email: "org1_interviewer@org1.com", roles: ["INTERVIEWER"], depts: ["ALL"] },
  { email: "org1_interviewer1@org1.com", roles: ["INTERVIEWER"], depts: ["IT", "Data Eng"] },
  { email: "org1_interviewer2@org1.com", roles: ["INTERVIEWER"], depts: ["UX", "DevOps"] },
  { email: "org1_vendor1@org1.com", roles: ["VENDOR"], depts: ["ALL"] },
  { email: "org1_vendor2@org1.com", roles: ["VENDOR"], depts: ["ALL"] },
];

async function seed() {
  const { prisma } = await import("./src/lib/prisma");

  console.log("🚀 Starting God Mode Seeding...");

  // 1. Find Org1 in Clerk
  const orgs = await clerk.organizations.getOrganizationList({ query: "Org1", limit: 10 });
  const org1 = orgs.data.find((o: any) => o.name === "Org1");

  if (!org1) {
    console.error("❌ ERROR: Could not find 'Org1' in Clerk. Please ensure you created it in the Clerk Dashboard named exactly 'Org1'.");
    process.exit(1);
  }
  
  const orgId = org1.id;
  console.log(`✅ Found Org1 in Clerk. ID: ${orgId}`);

  // 2. Create Departments in Prisma
  const deptNames = ["IT", "Data Eng", "UX", "DevOps"];
  const deptMap: Record<string, string> = {}; // Name to ID

  for (const name of deptNames) {
    let dept = await prisma.department.findFirst({
      where: { organizationId: orgId, name }
    });
    if (!dept) {
       dept = await prisma.department.create({
         data: { name, organizationId: orgId }
       });
    }
    deptMap[name] = dept.id;
  }
  console.log("✅ Seeded Departments in Prisma.");

  for (const u of usersToCreate) {
    console.log(`⏳ Processing ${u.email}...`);
    
    const userQuery = await clerk.users.getUserList({ emailAddress: [u.email] });
    let clerkUser = userQuery.data[0];

    // A. Create in Clerk if missing
    if (!clerkUser) {
      clerkUser = await clerk.users.createUser({
        emailAddress: [u.email],
        password: "Sachin@422010",
        firstName: u.email.split("@")[0],
        skipPasswordChecks: true,
      });
      console.log(`   ➕ Created in Clerk Backend.`);
    } else {
      console.log(`   ⏭️ Already exists in Clerk. Forcing password update...`);
      await clerk.users.updateUser(clerkUser.id, {
        password: "Sachin@422010",
        skipPasswordChecks: true,
      });
    }

    // B. Create Membership in Clerk Org1
    try {
      await clerk.organizations.createOrganizationMembership({
        organizationId: orgId,
        userId: clerkUser.id,
        role: "org:member" // Default clerk role, IQMela DB handles the true RBAC
      });
      console.log(`   ➕ Bound to Clerk Org1.`);
    } catch (e: any) {
      if (e.errors?.[0]?.code === "form_user_already_in_organization" || e.status === 400) {
        console.log(`   ⏭️ Already a member of Clerk Org1.`);
      } else {
        console.error(`   ❌ Warning mapping Org1 membership:`, e.message || e);
      }
    }

    // C. Map to exact Prisma Roles and Departments
    const deptConnections = u.depts.includes("ALL") ? [] : u.depts.map(d => ({ id: deptMap[d] }));

    // Delete any stale Prisma record with this email but a different Clerk ID
    const staleUser = await prisma.user.findUnique({ where: { email: u.email } });
    if (staleUser && staleUser.id !== clerkUser.id) {
      // Disconnect departments first to avoid FK issues
      await prisma.user.update({
        where: { id: staleUser.id },
        data: { departments: { set: [] } },
      });
      await prisma.user.delete({ where: { id: staleUser.id } });
      console.log(`   🧹 Deleted stale Prisma record (old ID: ${staleUser.id})`);
    }

    await prisma.user.upsert({
      where: { id: clerkUser.id },
      update: {
        organizationId: orgId,
        email: u.email,
        roles: u.roles as any,
        departments: deptConnections.length > 0 ? { set: deptConnections } : { set: [] },
      },
      create: {
        id: clerkUser.id,
        email: u.email,
        name: u.email.split("@")[0],
        organizationId: orgId,
        roles: u.roles as any,
        departments: deptConnections.length > 0 ? { connect: deptConnections } : undefined,
      }
    });
    console.log(`   ✅ Synced to Prisma with Roles: ${u.roles.join(", ")}`);
  }

  console.log("🎉 Seeding completely successful! All specific users, roles, and departments exist.");
}

seed().catch(console.error).then(() => process.exit(0));
