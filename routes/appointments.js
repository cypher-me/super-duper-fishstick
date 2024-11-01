// routes/appointments.js
const express = require('express');
const router = express.Router();
const { promisePool } = require('../db');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
};

// Book new appointment
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { doctor_id, appointment_date, appointment_time } = req.body;
        const patient_id = req.session.userId;

        // Check if doctor exists
        const [doctors] = await promisePool.execute(
            'SELECT schedule FROM doctors WHERE id = ?',
            [doctor_id]
        );

        if (doctors.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Check if slot is available
        const [existing] = await promisePool.execute(
            'SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status = "scheduled"',
            [doctor_id, appointment_date, appointment_time]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Time slot not available' });
        }

        // Create appointment
        const [result] = await promisePool.execute(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)',
            [patient_id, doctor_id, appointment_date, appointment_time]
        );

        res.status(201).json({
            message: 'Appointment booked successfully',
            appointmentId: result.insertId
        });

    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({ error: 'Error booking appointment' });
    }
});

// Get user's appointments
router.get('/my-appointments', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await promisePool.execute(
            `SELECT 
                a.id, a.appointment_date, a.appointment_time, a.status,
                d.first_name as doctor_first_name, d.last_name as doctor_last_name,
                d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date, a.appointment_time`,
            [req.session.userId]
        );

        res.json(rows);

    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Error fetching appointments' });
    }
});

// Get doctor's appointments (for doctors/admin)
router.get('/doctor/:doctorId', async (req, res) => {
    try {
        // Verify user is either admin or the doctor
        if (req.session.userType !== 'admin' && 
            (req.session.userType !== 'doctor' || req.session.userId !== parseInt(req.params.doctorId))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const [rows] = await promisePool.execute(
            `SELECT 
                a.id, a.appointment_date, a.appointment_time, a.status,
                p.first_name as patient_first_name, p.last_name as patient_last_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ?
            ORDER BY a.appointment_date, a.appointment_time`,
            [req.params.doctorId]
        );

        res.json(rows);

    } catch (error) {
        console.error('Error fetching doctor appointments:', error);
        res.status(500).json({ error: 'Error fetching appointments' });
    }
});

// Update appointment status
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { status } = req.body;
        const appointmentId = req.params.id;

        // Verify appointment belongs to user
        const [appointments] = await promisePool.execute(
            'SELECT patient_id FROM appointments WHERE id = ?',
            [appointmentId]
        );

        if (appointments.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        if (appointments[0].patient_id !== req.session.userId && req.session.userType !== 'admin') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Update status
        await promisePool.execute(
            'UPDATE appointments SET status = ? WHERE id = ?',
            [status, appointmentId]
        );

        res.json({ message: 'Appointment updated successfully' });

    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Error updating appointment' });
    }
});

// Cancel appointment
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        // Verify appointment belongs to user and is in the future
        const [appointments] = await promisePool.execute(
            `SELECT patient_id, appointment_date 
            FROM appointments 
            WHERE id = ? AND status = "scheduled"`,
            [req.params.id]
        );

        if (appointments.length === 0) {
            return res.status(404).json({ error: 'Appointment not found or already completed/canceled' });
        }

        if (appointments[0].patient_id !== req.session.userId && req.session.userType !== 'admin') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Update status to canceled
        await promisePool.execute(
            'UPDATE appointments SET status = "canceled" WHERE id = ?',
            [req.params.id]
        );

        res.json({ message: 'Appointment canceled successfully' });

    } catch (error) {
        console.error('Error canceling appointment:', error);
        res.status(500).json({ error: 'Error canceling appointment' });
    }
});

module.exports = router;