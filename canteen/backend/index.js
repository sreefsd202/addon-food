import express from "express";
import cors from "cors";
import connectDB from "./connection.js";
import Menu from "./models/menu.js";
import Order from "./models/order.js";
import Feedback from "./models/Feedback.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "your_jwt_secret_key_change_in_production";

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Helper function to generate unique tokens (3 digits)
const generateToken = () => {
  const chars = '0123456789';
  let token = '';
  for (let i = 0; i < 3; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

// Generate payment ID (10 characters)
const generatePaymentId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PAY${timestamp}${random}`;
};

// ============================================
// FEEDBACK ROUTES
// ============================================
app.post("/feedback", async (req, res) => {
  try {
    const feedback = new Feedback({ message: req.body.message });
    await feedback.save();
    res.json(feedback);
  } catch {
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

app.get("/feedback", async (req, res) => {
  const feedbacks = await Feedback.find().sort({ createdAt: 1 });
  res.json(feedbacks);
});

// ============================================
// ADMIN ROUTES
// ============================================
app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body
    
    if (username === 'admin' && password === '12345') {
      res.json({ message: 'Admin login successful' })
    } else {
      res.status(401).json({ message: 'Invalid admin credentials' })
    }
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(500).json({ message: 'Server error during admin login' })
  }
});

// Get dashboard statistics
app.get("/admin/stats", async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({
      status: { $in: ['confirmed', 'preparing'] }
    });
    const readyOrders = await Order.countDocuments({ status: 'ready' });
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'collected' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    res.json({
      totalOrders,
      pendingOrders,
      readyOrders,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Get revenue analytics by date range
app.get("/admin/revenue/analytics", async (req, res) => {
  try {
    const { period } = req.query;
    
    let groupFormat;
    
    switch(period) {
      case 'day':
        groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } };
        break;
      case 'month':
        groupFormat = { $dateToString: { format: "%Y-%m", date: "$updatedAt" } };
        break;
      case 'year':
        groupFormat = { $dateToString: { format: "%Y", date: "$updatedAt" } };
        break;
      default:
        groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } };
    }
    
    const revenueData = await Order.aggregate([
      { $match: { status: 'collected' } },
      {
        $group: {
          _id: groupFormat,
          totalRevenue: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: "$totalAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json(revenueData);
  } catch (error) {
    console.error("Revenue analytics error:", error);
    res.status(500).json({ error: "Failed to fetch revenue analytics" });
  }
});

// Get detailed statistics
app.get("/admin/detailed-stats", async (req, res) => {
  try {
    const [totalOrders, pendingOrders, readyOrders, revenueResult] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({
        status: { $in: ['confirmed', 'preparing'] }
      }),
      Order.countDocuments({ status: 'ready' }),
      Order.aggregate([
        { $match: { status: 'collected' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRevenue = await Order.aggregate([
      { 
        $match: { 
          status: 'collected',
          createdAt: { $gte: today }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    res.json({
      totalOrders,
      pendingOrders,
      readyOrders,
      totalRevenue: revenueResult[0]?.total || 0,
      todayRevenue: todayRevenue[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ============================================
// USER AUTH ROUTES
// ============================================
app.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: "Signup successful" });
  } catch (error) {
    console.error("Signup backend error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// USER LOGIN
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// ============================================
// MENU ROUTES
// ============================================
app.get("/menu/categories", async (req, res) => {
  try {
    const categories = await Menu.distinct("category");
    const nonEmptyCategories = await Promise.all(
      categories.map(async (category) => {
        const count = await Menu.countDocuments({ category });
        return { name: category, count };
      })
    );
    res.json(nonEmptyCategories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.post("/menu/add", async (req, res) => {
  try {
    const item = new Menu(req.body);
    await item.save();
    res.json({ message: "Item added", item });
  } catch (error) {
    res.status(500).json({ error: "Failed to add item" });
  }
});

app.get("/menu", async (req, res) => {
  try {
    const items = await Menu.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

app.put("/menu/buy/:id", async (req, res) => {
  try {
    const item = await Menu.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (item.quantity <= 0) return res.status(400).json({ error: "Out of stock" });

    item.quantity -= 1;
    await item.save();
    res.json({ message: "Purchase successful", item });
  } catch (error) {
    res.status(500).json({ error: "Failed to update stock" });
  }
});

app.put("/menu/update/:id", async (req, res) => {
  try {
    const item = await Menu.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item updated", item });
  } catch (error) {
    res.status(500).json({ error: "Failed to update item" });
  }
});

app.delete("/menu/delete/:id", async (req, res) => {
  try {
    const item = await Menu.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item deleted", item });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ============================================
// ORDER ROUTES
// ============================================

// Create order with payment (Protected)
app.post("/orders/create", authenticateToken, async (req, res) => {
  try {
    const { items, totalAmount, paymentMethod } = req.body;
    const userId = req.user.id;
    
    const orderToken = generateToken();
    const paymentId = generatePaymentId();
    
    const order = new Order({
      userId,
      orderToken,
      paymentId,
      items,
      totalAmount,
      paymentMethod: paymentMethod || 'online',
      status: 'confirmed'
    });
    
    await order.save();
    
    // Update stock for each item
    for (const item of items) {
      await Menu.findByIdAndUpdate(item.itemId, {
        $inc: { quantity: -item.quantity }
      });
    }
    
    res.json({
      success: true,
      orderToken,
      paymentId,
      totalAmount,
      paymentMethod: paymentMethod || 'online',
      message: "Order created successfully",
      orderId: order._id
    });
    
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Get user's order history (Protected)
app.get("/api/orders/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching order history:", error);
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});

// Cancel order (Protected)
app.put("/api/orders/:orderId/cancel", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    
    const order = await Order.findOne({ _id: orderId, userId });
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    if (order.status === 'ready' || order.status === 'collected') {
      return res.status(400).json({ 
        error: "Cannot cancel order. Order is already ready or collected." 
      });
    }
    
    // Restore stock
    for (const item of order.items) {
      await Menu.findByIdAndUpdate(item.itemId, {
        $inc: { quantity: item.quantity }
      });
    }
    
    await Order.findByIdAndDelete(orderId);
    
    res.json({ 
      success: true,
      message: "Order cancelled successfully and stock restored" 
    });
    
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// Get order by token
app.get("/orders/:token", async (req, res) => {
  try {
    const order = await Order.findOne({ orderToken: req.params.token });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// Get all orders (for admin)
app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Update order status (for admin)
app.put("/orders/:token/status", async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['confirmed', 'preparing', 'ready', 'collected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    const updateData = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (status === 'collected') {
      updateData.collectedAt = new Date();
    }
    
    const order = await Order.findOneAndUpdate(
      { orderToken: req.params.token },
      updateData,
      { new: true }
    );
    
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ message: "Order status updated", order });
  } catch (error) {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Delete order by token (for admin)
app.delete("/orders/:token", async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({ orderToken: req.params.token });
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    if (order.status !== 'collected') {
      for (const item of order.items) {
        await Menu.findByIdAndUpdate(item.itemId, {
          $inc: { quantity: item.quantity }
        });
      }
    }
    
    res.json({ 
      message: "Order deleted successfully",
      order 
    });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});