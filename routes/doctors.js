// routes/doctors.js
const express = require('express');
const router = express.Router();
const { promisePool } = require('../db');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    if (!req.session.userId || req.session.userType !== 'admin') {
        return res.status(401).json({ error: 'Admin access required' });
    }
    next();
};

// Create new doctor (admin only)
router.post('/', isAdmin, async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            specialization,
            email,
            phone,
            schedule
        } = req.body;

        const [result] = await promisePool.execute(
            'INSERT INTO doctors (first_name, last_name, specialization, email, phone, schedule) VALUES (?, ?, ?, ?, ?, ?)',
            [first_name, last_name, specialization, email, phone, JSON.stringify(schedule)]
        );

        res.status(201).json({
            message: 'Doctor added successfully',
            doctorId: result.insertId
        });

    } catch (error) {
        console.error('Error adding doctor:', error);
        res.status(500).json({ error: 'Error adding doctor' });
    }
});

// Get all doctors
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.execute(
            'SELECT doctor_id, first_name, last_name, specialization, email, phone, schedule FROM doctors'
        );

        // Parse schedule JSON for each doctor
        const doctors = rows.map(doctor => ({
            ...doctor,
            schedule: JSON.parse(doctor.schedule)
        }));

        res.json(doctors);

    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ error: 'Error fetching doctors' });
    }
});

// Get specific doctor
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.execute(
            'SELECT id, first_name, last_name, specialization, email, phone, schedule FROM doctors WHERE id = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        const doctor = {
            ...rows[0],
            schedule: JSON.parse(rows[0].schedule)
        };

        res.json(doctor);

    } catch (error) {
        console.error('Error fetching doctor:', error);
        res.status(500).json({ error: 'Error fetching doctor' });
    }
});

// Update doctor (admin only)
router.put('/:id', isAdmin, async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            specialization,
            email,
            phone,
            schedule
        } = req.body;

        await promisePool.execute(
            'UPDATE doctors SET first_name = ?, last_name = ?, specialization = ?, email = ?, phone = ?, schedule = ? WHERE id = ?',
            [first_name, last_name, specialization, email, phone, JSON.stringify(schedule), req.params.id]
        );

        res.json({ message: 'Doctor updated successfully' });

    } catch (error) {
        console.error('Error updating doctor:', error);
        res.status(500).json({ error: 'Error updating doctor' });
    }
});

// Delete doctor (admin only)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        // First check for future appointments
        const [appointments] = await promisePool.execute(
            'SELECT id FROM appointments WHERE doctor_id = ? AND status = "scheduled" AND appointment_date >= CURDATE()',
            [req.params.id]
        );

        if (appointments.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete doctor with future appointments' 
            });
        }

        // Delete past appointments
        await promisePool.execute(
            'DELETE FROM appointments WHERE doctor_id = ?',
            [req.params.id]
        );

        // Delete doctor
        await promisePool.execute(
            'DELETE FROM doctors WHERE id = ?',
            [req.params.id]
        );

        res.json({ message: 'Doctor deleted successfully' });

    } catch (error) {
        console.error('Error deleting doctor:', error);
        res.status(500).json({ error: 'Error deleting doctor' });
    }
});

module.exports = router;