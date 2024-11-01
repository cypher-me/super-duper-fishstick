// routes/admin.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { promisePool } = require('../db');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    if (!req.session.userId || req.session.userType !== 'admin') {
        return res.status(401).json({ error: 'Admin access required' });
    }
    next();
};

// Admin login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const [rows] = await promisePool.execute(
            'SELECT * FROM admin WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = rows[0];
        const validPassword = await bcrypt.compare(password, admin.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Set session
        req.session.userId = admin.id;
        req.session.userType = 'admin';

        res.json({ 
            message: 'Admin login successful',
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Error during login' });
    }
});

// Get all patients (admin only)
router.get('/patients', isAdmin, async (req, res) => {
    try {
        const [rows] = await promisePool.execute(
            'SELECT id, first_name, last_name, email, phone, date_of_birth, gender, address FROM patients'
        );

        res.json(rows);

    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Error fetching patients' });
    }
});

// Get system statistics (admin only)
router.get('/statistics', isAdmin, async (req, res) => {
    try {
        // Get counts
        const [[patientCount]] = await promisePool.execute(
            'SELECT COUNT(*) as count FROM patients'
        );
        
        const [[doctorCount]] = await promisePool.execute(
            'SELECT COUNT(*) as count FROM doctors'
        );
        
        const [[appointmentCount]] = await promisePool.execute(
            'SELECT COUNT(*) as count FROM appointments'
        );

        // Get upcoming appointments
        const [upcomingAppointments] = await promisePool.execute(
            `SELECT COUNT(*) as count 
            FROM appointments 
            WHERE status = 'scheduled' 
            AND appointment_date >= CURDATE()`
        );

        // Get appointments by status
        const [appointmentsByStatus] = await promisePool.execute(
            `SELECT status, COUNT(*) as count 
            FROM appointments 
            GROUP BY status`
        );

        res.json({
            totalPatients: patientCount.count,
            totalDoctors: doctorCount.count,
            totalAppointments: appointmentCount.count,
            upcomingAppointments: upcomingAppointments[0].count,
            appointmentsByStatus
        });

    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Error fetching statistics' });
    }
});

// Admin logout
router.post('/logout', isAdmin, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

module.exports = router;