import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { Database } from './server/db.js'; // الاتصال الفعلي متأسس جوة الملف ده

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple token storage (in-memory session map)
  const sessions = new Map<string, string>(); // Token -> Username

  // Middleware to authenticate admin requests
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth token missing or invalid format' });
    }
    
    const token = authHeader.split(' ')[1];
    const username = sessions.get(token);
    
    if (!username) {
      return res.status(401).json({ error: 'Unauthorized session' });
    }
    
    next();
  };

  // --- API ROUTES (Updated to support async Database operations) ---

  // Auth
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const isValid = await Database.checkAdminCredentials(username, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions.set(token, username);

    res.json({ success: true, token, username });
  });

  app.get('/api/auth/session', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ authenticated: false });
    }
    const token = authHeader.split(' ')[1];
    const username = sessions.get(token);
    
    if (username) {
      res.json({ authenticated: true, username });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      sessions.delete(token);
    }
    res.json({ success: true });
  });

  // Materials CRUD
  app.get('/api/materials', async (req, res) => {
    try {
      const materials = await Database.getMaterials();
      res.json(materials);
    } catch (err) {
      res.status(500).json({ error: 'Database error fetching materials' });
    }
  });

  app.post('/api/materials', requireAdmin, async (req, res) => {
    const success = await Database.addMaterial(req.body);
    if (success) {
      res.status(201).json({ success: true, material: req.body });
    } else {
      res.status(400).json({ error: 'Failed to add material or ID already exists' });
    }
  });

  app.put('/api/materials/:id', requireAdmin, async (req, res) => {
    const success = await Database.updateMaterial(req.params.id, req.body);
    if (success) {
      res.json({ success: true, material: req.body });
    } else {
      res.status(404).json({ error: 'Material not found' });
    }
  });

  app.delete('/api/materials/:id', requireAdmin, async (req, res) => {
    const success = await Database.deleteMaterial(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Material not found' });
    }
  });

  // Items CRUD
  app.get('/api/items', async (req, res) => {
    try {
      const items = await Database.getItems();
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: 'Database error fetching items' });
    }
  });

  app.post('/api/items', requireAdmin, async (req, res) => {
    const success = await Database.addItem(req.body);
    if (success) {
      res.status(201).json({ success: true, item: req.body });
    } else {
      res.status(400).json({ error: 'Failed to add item or ID already exists' });
    }
  });

  app.put('/api/items/:id', requireAdmin, async (req, res) => {
    const success = await Database.updateItem(req.params.id, req.body);
    if (success) {
      res.json({ success: true, item: req.body });
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  });

  app.delete('/api/items/:id', requireAdmin, async (req, res) => {
    const success = await Database.deleteItem(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  });

  // Recipes API
  app.get('/api/recipes', async (req, res) => {
    try {
      const recipes = await Database.getRecipes();
      res.json(recipes);
    } catch (err) {
      res.status(500).json({ error: 'Database error fetching recipes' });
    }
  });

  app.put('/api/recipes/:itemId', requireAdmin, async (req, res) => {
    const success = await Database.updateRecipe(req.params.itemId, req.body.ingredients);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to update recipe' });
    }
  });

  // Prices API
  app.get('/api/prices', async (req, res) => {
    try {
      const prices = await Database.getPrices();
      res.json(prices);
    } catch (err) {
      res.status(500).json({ error: 'Database error fetching prices' });
    }
  });

  app.put('/api/prices/:materialId', requireAdmin, async (req, res) => {
    const { price } = req.body;
    const success = await Database.updatePrice(req.params.materialId, Number(price));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to update price' });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Albion Craft Calculator server running at http://localhost:${PORT}`);
  });
}

startServer();