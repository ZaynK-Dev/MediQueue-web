const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

require('dotenv').config();
const prisma = new PrismaClient({});

async function main() {
  console.log('Seeding data...');

  const passwordHash = await bcrypt.hash('123456', 10);

  const hospitalsData = [
    { name: 'AIIMS Nagpur', location: 'Nagpur' },
    { name: 'Wockhardt Hospital', location: 'Nagpur' },
    { name: 'Ganga Care Hospital', location: 'Nagpur' },
    { name: 'Kunal Hospital', location: 'Nagpur' },
    { name: 'Arihant Hospital', location: 'Nagpur' }
  ];

  const doctorsData = [
    { name: 'Atul', email: 'atul@aiims.com', hospitalName: 'AIIMS Nagpur', specialization: 'General Medicine', category: 'General Physician', doctorRole: 'Consultant' },
    { name: 'Nitin', email: 'nitin@wockhardt.com', hospitalName: 'Wockhardt Hospital', specialization: 'Cardiology', category: 'Specialist', doctorRole: 'Consultant' },
    { name: 'Priyesh', email: 'priyesh@ganga.com', hospitalName: 'Ganga Care Hospital', specialization: 'Orthopedics', category: 'Surgeon', doctorRole: 'Consultant' },
    { name: 'Nikhil', email: 'nikhil@kunal.com', hospitalName: 'Kunal Hospital', specialization: 'Pediatrics', category: 'General Physician', doctorRole: 'Duty Doctor' },
    { name: 'Aditya', email: 'aditya@arihant.com', hospitalName: 'Arihant Hospital', specialization: 'Emergency Medicine', category: 'Emergency Doctor', doctorRole: 'Duty Doctor' }
  ];

  for (const h of hospitalsData) {
    let hospital = await prisma.hospital.findFirst({ where: { name: h.name } });
    if (!hospital) {
      hospital = await prisma.hospital.create({ data: h });
    }

    const doctorInfo = doctorsData.find(d => d.hospitalName === h.name);
    if (doctorInfo) {
      let user = await prisma.user.findUnique({ where: { email: doctorInfo.email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            role: 'DOCTOR',
            name: doctorInfo.name,
            email: doctorInfo.email,
            password: passwordHash
          }
        });
        await prisma.doctorProfile.create({
          data: {
            userId: user.id,
            hospitalId: hospital.id,
            specialization: doctorInfo.specialization,
            category: doctorInfo.category,
            doctorRole: doctorInfo.doctorRole
          }
        });
      }
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
