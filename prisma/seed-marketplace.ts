/**
 * IQMela — Interviewer Seed Script
 * Seeds 10 marketplace + 5 Org1 internal dummy interviewers.
 *
 * Auto-detects the Org1 organization ID from org1_admin@org1.com.
 * Uses upsert — safe to run multiple times.
 *
 * Run: npm run seed:interviewers
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, InterviewerSource } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env (fallback to .env.local)
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });


// ── 10 Marketplace Interviewers ───────────────────────────────────────────────
const MARKETPLACE_INTERVIEWERS = [
  {
    email: "mkt_priya@iqmela-test.com",
    name: "Priya Nair",
    title: "Staff Backend Engineer",
    bio: "10+ years building distributed systems at scale. Ex-Stripe, Ex-Google. Specialises in Go microservices and PostgreSQL performance tuning.",
    department: "Engineering",
    skills: ["Go", "Node.js", "PostgreSQL", "Redis", "System Design", "gRPC", "Docker"],
    expertise: "Backend systems, API design, database optimisation",
    hourlyRate: 180,
    totalInterviews: 247,
    avgRating: 4.9,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/priya-nair-fake",
  },
  {
    email: "mkt_marcus@iqmela-test.com",
    name: "Marcus Chen",
    title: "Frontend Architect",
    bio: "React core contributor and former Meta web performance lead. Passionate about zero-jank UIs and design systems.",
    department: "Engineering",
    skills: ["React", "TypeScript", "Next.js", "Web Vitals", "CSS", "Design Systems", "Webpack"],
    expertise: "Frontend architecture, performance, component libraries",
    hourlyRate: 165,
    totalInterviews: 189,
    avgRating: 4.7,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/marcus-chen-fake",
  },
  {
    email: "mkt_aisha@iqmela-test.com",
    name: "Aisha Okafor",
    title: "ML / AI Engineer",
    bio: "Led GenAI teams at Cohere and Anthropic. Deep expertise in LLM fine-tuning, RAG pipelines, and production ML infrastructure.",
    department: "AI / ML",
    skills: ["Python", "TensorFlow", "PyTorch", "LLMs", "RAG", "LangChain", "Vector DBs"],
    expertise: "Machine learning, generative AI, MLOps",
    hourlyRate: 200,
    totalInterviews: 156,
    avgRating: 4.8,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/aisha-okafor-fake",
  },
  {
    email: "mkt_rahul@iqmela-test.com",
    name: "Rahul Sharma",
    title: "Full-Stack Lead",
    bio: "Full-stack generalist with deep AWS and DevOps experience. Has led engineering teams of 20+ across fintech and healthcare.",
    department: "Engineering",
    skills: ["React", "Node.js", "AWS", "Docker", "CI/CD", "PostgreSQL", "TypeScript"],
    expertise: "Full-stack development, cloud architecture, team leadership",
    hourlyRate: 155,
    totalInterviews: 312,
    avgRating: 4.6,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/rahul-sharma-fake",
  },
  {
    email: "mkt_sofia@iqmela-test.com",
    name: "Sofia Gonzalez",
    title: "Data Engineer",
    bio: "Senior data engineer with expertise in modern data stack. Helped scale Airbnb's analytics platform to petabyte scale.",
    department: "Data",
    skills: ["Apache Spark", "Kafka", "dbt", "Snowflake", "Airflow", "Python", "SQL"],
    expertise: "ETL pipelines, data warehousing, real-time streaming",
    hourlyRate: 170,
    totalInterviews: 203,
    avgRating: 4.9,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/sofia-gonzalez-fake",
  },
  {
    email: "mkt_james@iqmela-test.com",
    name: "James Okonkwo",
    title: "DevOps / Platform Engineer",
    bio: "Platform engineering specialist. Built and operated Kubernetes clusters powering 10M+ rps at Twitter and Cloudflare.",
    department: "DevOps",
    skills: ["Kubernetes", "Terraform", "GCP", "AWS", "Helm", "Prometheus", "Security"],
    expertise: "Platform engineering, cloud infrastructure, SRE",
    hourlyRate: 185,
    totalInterviews: 178,
    avgRating: 4.7,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/james-okonkwo-fake",
  },
  {
    email: "mkt_yuki@iqmela-test.com",
    name: "Yuki Tanaka",
    title: "iOS Engineer",
    bio: "Senior iOS engineer and Apple design award mentor. 8 years building consumer-grade Swift apps with a focus on performance and accessibility.",
    department: "Mobile",
    skills: ["Swift", "SwiftUI", "UIKit", "Combine", "Core Data", "TestFlight", "Xcode"],
    expertise: "iOS development, mobile architecture, accessibility",
    hourlyRate: 160,
    totalInterviews: 134,
    avgRating: 4.5,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/yuki-tanaka-fake",
  },
  {
    email: "mkt_ananya@iqmela-test.com",
    name: "Ananya Patel",
    title: "Application Security Engineer",
    bio: "OSCP-certified security engineer. Previously led red-team exercises at Palantir. Expert in SAST, threat modelling, and zero-trust architecture.",
    department: "Security",
    skills: ["OWASP", "Penetration Testing", "SAST", "IAM", "SIEM", "Threat Modelling", "Zero Trust"],
    expertise: "Application security, pen testing, compliance",
    hourlyRate: 195,
    totalInterviews: 98,
    avgRating: 4.8,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/ananya-patel-fake",
  },
  {
    email: "mkt_carlos@iqmela-test.com",
    name: "Carlos Rivera",
    title: "Distributed Systems Engineer",
    bio: "Distributed systems nerd. Built consensus protocols at Cockroach Labs. Deep expertise in fault-tolerant architectures and event-sourcing.",
    department: "Engineering",
    skills: ["Go", "gRPC", "Kafka", "Cassandra", "CockroachDB", "Event Sourcing", "CQRS"],
    expertise: "Distributed systems, consensus algorithms, event-driven architecture",
    hourlyRate: 190,
    totalInterviews: 121,
    avgRating: 4.7,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/carlos-rivera-fake",
  },
  {
    email: "mkt_fatima@iqmela-test.com",
    name: "Fatima Al-Hassan",
    title: "Senior Product Manager",
    bio: "Product leader with a track record of 0-to-1 launches. Previously GM at Notion and Head of Product at Linear. Specialises in technical PM interviews.",
    department: "Product",
    skills: ["Product Strategy", "Roadmapping", "Agile", "A/B Testing", "Stakeholder Mgmt", "OKRs", "User Research"],
    expertise: "Product management, GTM strategy, technical product leadership",
    hourlyRate: 145,
    totalInterviews: 267,
    avgRating: 4.6,
    isVerified: true,
    avatarUrl: null,
    linkedinUrl: "https://linkedin.com/in/fatima-alhassan-fake",
  },
];

// ── 5 Org1 Internal Interviewers ──────────────────────────────────────────────
const ORG1_INTERNAL_INTERVIEWERS = [
  {
    email: "org1_interviewer3@org1.com",
    name: "Alex Turner",
    title: "Senior Software Engineer",
    bio: "Full-stack engineer with 7 years in TypeScript and React. Has conducted 80+ technical interviews.",
    department: "IT / Engineering",
    skills: ["TypeScript", "React", "Node.js", "GraphQL", "PostgreSQL"],
    expertise: "Frontend and backend JavaScript, system design",
    totalInterviews: 83,
    avgRating: 4.5,
  },
  {
    email: "org1_interviewer4@org1.com",
    name: "Nina Patel",
    title: "Tech Lead — Data",
    bio: "Data engineering lead. Expert in Python-based ETL systems and analytical pipelines.",
    department: "Data Engineering",
    skills: ["Python", "Django", "PostgreSQL", "Apache Spark", "Airflow", "dbt"],
    expertise: "Data pipelines, backend APIs, SQL optimisation",
    totalInterviews: 61,
    avgRating: 4.6,
  },
  {
    email: "org1_interviewer5@org1.com",
    name: "Sam Richardson",
    title: "Senior DevOps Engineer",
    bio: "Cloud infrastructure specialist. Manages Org1's AWS production environment.",
    department: "DevOps",
    skills: ["AWS", "Docker", "Kubernetes", "Terraform", "GitHub Actions", "Prometheus"],
    expertise: "Cloud infrastructure, CI/CD, SRE practices",
    totalInterviews: 44,
    avgRating: 4.4,
  },
  {
    email: "org1_interviewer6@org1.com",
    name: "Mei Lin",
    title: "Senior Product Designer",
    bio: "UX lead at Org1. Focuses on design systems, accessibility, and research-led design.",
    department: "UX / Design",
    skills: ["Figma", "UX Research", "CSS", "Design Systems", "Accessibility", "Framer"],
    expertise: "Product design, user research, interaction design",
    totalInterviews: 38,
    avgRating: 4.7,
  },
  {
    email: "org1_interviewer7@org1.com",
    name: "Tobias Wolf",
    title: "Engineering Manager",
    bio: "People-first engineering leader. Specialises in system design and behavioural interviews for senior+ engineers.",
    department: "IT / Engineering",
    skills: ["System Design", "Leadership", "Distributed Systems", "Architecture Review", "Mentoring"],
    expertise: "Technical leadership, system design, senior IC evaluation",
    totalInterviews: 156,
    avgRating: 4.8,
  },
];

async function main() {
  console.log("🌱 IQMela Interviewer Seed Script\n");

  // ── Auto-detect Org1's organizationId ────────────────────────────────────
  const adminUser = await prisma.user.findUnique({
    where: { email: "org1_admin@org1.com" },
    select: { organizationId: true },
  });

  if (!adminUser?.organizationId) {
    console.error("❌ Could not find org1_admin@org1.com in the database.");
    console.error("   Make sure you have run the base user seed first.");
    process.exit(1);
  }

  const orgId = adminUser.organizationId;
  console.log(`✅ Detected Org1 organisationId: ${orgId}\n`);

  // ── Seed marketplace interviewers ─────────────────────────────────────────
  console.log("📦 Seeding 10 marketplace interviewers...");
  for (const iv of MARKETPLACE_INTERVIEWERS) {
    const { email, name, title, bio, department, skills, expertise, hourlyRate, totalInterviews, avgRating, isVerified, avatarUrl, linkedinUrl } = iv;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name,
        roles: ["B2B_INTERVIEWER"],
        organizationId: orgId,
      },
    });

    await prisma.interviewerProfile.upsert({
      where: { userId: user.id },
      update: {
        title,
        bio,
        department,
        expertise,
        skillsJson: skills,
        source: InterviewerSource.MARKETPLACE,
        hourlyRate,
        totalInterviews,
        avgRating,
        isVerified,
        avatarUrl,
        linkedinUrl,
      },
      create: {
        userId: user.id,
        title,
        bio,
        department,
        expertise,
        skillsJson: skills,
        source: InterviewerSource.MARKETPLACE,
        hourlyRate,
        totalInterviews,
        avgRating,
        isVerified,
        avatarUrl,
        linkedinUrl,
      },
    });

    console.log(`   ✅ ${name} (${email})`);
  }

  // ── Seed Org1 internal interviewers ───────────────────────────────────────
  console.log("\n🏢 Seeding 5 Org1 internal interviewers...");
  for (const iv of ORG1_INTERNAL_INTERVIEWERS) {
    const { email, name, title, bio, department, skills, expertise, totalInterviews, avgRating } = iv;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name,
        roles: ["B2B_INTERVIEWER"],
        organizationId: orgId,
      },
    });

    await prisma.interviewerProfile.upsert({
      where: { userId: user.id },
      update: {
        title,
        bio,
        department,
        expertise,
        skillsJson: skills,
        source: InterviewerSource.INTERNAL,
        totalInterviews,
        avgRating,
        isVerified: false,
        hourlyRate: null,
      },
      create: {
        userId: user.id,
        title,
        bio,
        department,
        expertise,
        skillsJson: skills,
        source: InterviewerSource.INTERNAL,
        totalInterviews,
        avgRating,
        isVerified: false,
        hourlyRate: null,
      },
    });

    console.log(`   ✅ ${name} (${email})`);
  }

  console.log("\n🎉 Done! 15 interviewers seeded successfully.");
  console.log("   ├ 10 marketplace (Marketplace tab in ScheduleDrawer)");
  console.log("   └  5 Org1 internal (Your Team tab in ScheduleDrawer)");
  console.log("\n⚠️  NOTE: To enable LOGIN for the 5 Org1 internal interviewers,");
  console.log("   create matching Clerk accounts via https://dashboard.clerk.com");
  console.log("   Use password: Sachin@422010");
  console.log("   Emails: org1_interviewer3..7@org1.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
