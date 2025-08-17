import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || "t.martinovic@mpg.hr"
  const password = process.env.ADMIN_PASSWORD || "superuser1"
  const hashed = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashed,
      role: 'SUPERADMIN',
    },
    create: {
      email,
      passwordHash: hashed,
      role: 'SUPERADMIN',
    },
  })

  console.log("✅ Superadmin ready:", user.email, user.role)
}

main()
  .catch(e => {
    console.error("❌ Seed error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
