const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get all hospitals
router.get('/', async (req, res) => {
  try {
    const hospitals = await prisma.hospital.findMany();
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get doctors for a hospital
router.get('/:hospitalId/doctors', async (req, res) => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      where: { hospitalId: req.params.hospitalId },
      include: { user: { select: { name: true, email: true } } }
    });
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
