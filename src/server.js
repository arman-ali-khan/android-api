import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'test_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Print initial database configuration (hiding sensitive data)
console.log('\n📊 Database Configuration:');
console.log(`Host: ${process.env.DB_HOST}`);
console.log(`Database: ${process.env.DB_NAME}`);
console.log(`User: ${process.env.DB_USER}`);
console.log('Attempting to connect...\n');

// Database connection status endpoint
app.get('/api/status', async (req, res) => {
  try {
    // Test the connection by running a simple query
    await pool.query('SELECT 1');
    res.json({ 
      status: 'connected',
      message: 'Database connection is active',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      status: 'disconnected',
      message: 'Database connection error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.get('/api/items', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const { location, contacts, image, call_logs, sms } = req.body;
    const [result] = await pool.query(
      'INSERT INTO items (location, contacts, image, call_logs, sms) VALUES (?, ?, ?, ?, ?)',
      [location, contacts, image, call_logs, sms]
    );
    res.status(201).json({ 
      id: result.insertId,
      location,
      contacts,
      image,
      call_logs,
      sms
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM items WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const [result] = await pool.query(
      'UPDATE items SET name = ?, description = ? WHERE id = ?',
      [name, description, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({ id: req.params.id, name, description });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM items WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Connection status monitoring
let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;

const checkConnection = async () => {
  try {
    const startTime = Date.now();
    await pool.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    if (!isConnected) {
      console.clear();
      console.log('\n=== Database Connection Status ===');
      console.log('✅ Connection established successfully');
      console.log(`📡 Response time: ${responseTime}ms`);
      console.log(`🏢 Host: ${process.env.DB_HOST}`);
      console.log(`📚 Database: ${process.env.DB_NAME}`);
      console.log('===============================\n');
      isConnected = true;
      connectionAttempts = 0;
    }
  } catch (error) {
    connectionAttempts++;
    console.clear();
    console.log('\n=== Database Connection Status ===');
    console.log('❌ Connection failed');
    console.log(`⚠️  Error: ${error.message}`);
    console.log(`🔄 Attempt: ${connectionAttempts}/${MAX_RETRY_ATTEMPTS}`);
    console.log('===============================\n');
    
    if (isConnected) {
      isConnected = false;
    }
    
    if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
      console.log('❌ Maximum retry attempts reached. Please check your database configuration.');
      process.exit(1);
    }
  }
};

// Check connection every 5 seconds
setInterval(checkConnection, 100000);

// Initial connection check
checkConnection();

// Start server
app.listen(port, () => {
  console.log(`\n🚀 Server running at http://localhost:${port}`);
});