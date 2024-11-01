// routes/patients.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { promisePool } = require('../db');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
};

// Patient Registration
router.post('/register', async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            password,
            phone,
            date_of_birth,
            gender,
            address
        } = req.body;

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert into database
        const [result] = await promisePool.execute(
            'INSERT INTO patients (first_name, last_name, email, password_hash, phone, date_of_birth, gender, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [first_name, last_name, email, password_hash, phone, date_of_birth, gender, address]
        );

        res.status(201).json({ 
            message: 'Patient registered successfully',
            patientId: result.insertId 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Error registering patient' });
    }
});

// Patient Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get patient from database
        const [rows] = await promisePool.execute(
            'SELECT * FROM patients WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const patient = rows[0];
        const validPassword = await bcrypt.compare(password, patient.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Set session
        req.session.userId = patient.id;
        req.session.userType = 'patient';

        res.json({ 
            message: 'Login successful',
            patient: {
                id: patient.id,
                first_name: patient.first_name,
                last_name: patient.last_name,
                email: patient.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error during login' });
    }
});

// Get Patient Profile
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await promisePool.execute(
            'SELECT id, first_name, last_name, email, phone, date_of_birth, gender, address FROM patients WHERE id = ?',
            [req.session.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json(rows[0]);

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Error fetching profile' });
    }
});

// Update Patient Profile
router.put('/profile', isAuthenticated, async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            phone,
            address
        } = req.body;

        await promisePool.execute(
            'UPDATE patients SET first_name = ?, last_name = ?, phone = ?, address = ? WHERE id = ?',
            [first_name, last_name, phone, address, req.session.userId]
        );

        res.json({ message: 'Profile updated successfully' });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

// Delete Patient Account
router.delete('/profile', isAuthenticated, async (req, res) => {
    try {
        // First delete all appointments
        await promisePool.execute(
            'DELETE FROM appointments WHERE patient_id = ?',
            [req.session.userId]
        );

        // Then delete patient
        await promisePool.execute(
            'DELETE FROM patients WHERE id = ?',
            [req.session.userId]
        );

        // Clear session
        req.session.destroy();

        res.json({ message: 'Account deleted successfully' });

    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Error deleting account' });
    }
});

// Logout
router.post('/logout', isAuthenticated, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

module.exports = router;