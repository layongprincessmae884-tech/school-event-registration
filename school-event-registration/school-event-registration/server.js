require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const path     = require('path');

const User         = require('./models/User');
const Event        = require('./models/Event');
const Registration = require('./models/Registration');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ---------------- AUTH MIDDLEWARE ----------------
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
}

const sign = (user) =>
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

const publicUser = (u) => ({
  id: u._id, fullName: u.fullName, studentId: u.studentId, email: u.email, role: u.role
});

// ---------------- AUTH ROUTES ----------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, studentId, email, password } = req.body;
    if (!fullName || !studentId || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });
    const existing = await User.findOne({ $or: [{ email }, { studentId }] });
    if (existing)
      return res.status(409).json({ message: 'Email or Student ID already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ fullName, studentId, email, password: hashed });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // email OR student ID
    const user = await User.findOne({ $or: [{ email: identifier }, { studentId: identifier }] });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: publicUser(user) });
});

// ---------------- EVENT ROUTES ----------------
app.get('/api/events', auth, async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { status: 'Active' };
  const events = await Event.find(filter).sort({ date: 1 });
  res.json(events);
});

app.get('/api/events/:id', auth, async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  const registrationCount = await Registration.countDocuments({ event: event._id });
  let registered = false;
  if (req.user.role === 'student') {
    registered = !!(await Registration.findOne({ student: req.user.id, event: event._id }));
  }
  res.json({ ...event.toObject(), registered, registrationCount });
});

app.post('/api/events', auth, adminOnly, async (req, res) => {
  try {
    const { name, date, venue, description, status } = req.body;
    if (!name || !date || !venue)
      return res.status(400).json({ message: 'Name, date and venue are required' });
    const event = await Event.create({ name, date, venue, description, status });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/events/:id', auth, adminOnly, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/events/:id', auth, adminOnly, async (req, res) => {
  await Registration.deleteMany({ event: req.params.id });
  await Event.findByIdAndDelete(req.params.id);
  res.json({ message: 'Event deleted' });
});

// ---------------- REGISTRATION ROUTES ----------------
app.post('/api/registrations', auth, async (req, res) => {
  try {
    const { eventId } = req.body;
    const event = await Event.findById(eventId);
    if (!event || event.status !== 'Active')
      return res.status(404).json({ message: 'Event not available' });
    const existing = await Registration.findOne({ student: req.user.id, event: eventId });
    if (existing)
      return res.status(409).json({ message: 'You are already registered for this event' });
    const reg = await Registration.create({ student: req.user.id, event: eventId });
    res.status(201).json(reg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/registrations/mine', auth, async (req, res) => {
  const regs = await Registration.find({ student: req.user.id })
    .populate('event')
    .sort({ createdAt: -1 });
  res.json(regs);
});

app.delete('/api/registrations/:id', auth, async (req, res) => {
  const reg = await Registration.findById(req.params.id);
  if (!reg) return res.status(404).json({ message: 'Registration not found' });
  if (reg.student.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Not allowed' });
  await reg.deleteOne();
  res.json({ message: 'Registration cancelled' });
});

// Admin: all registrations
app.get('/api/registrations', auth, adminOnly, async (req, res) => {
  const regs = await Registration.find()
    .populate('student', 'fullName studentId email')
    .populate('event', 'name date venue')
    .sort({ createdAt: -1 });
  res.json(regs);
});

// ---------------- SEED DATA & START ----------------
async function seed() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@rsu.edu.ph';
  if (!(await User.findOne({ email: adminEmail }))) {
    await User.create({
      fullName: 'System Administrator',
      studentId: 'ADMIN-001',
      email: adminEmail,
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10),
      role: 'admin'
    });
    console.log('Seeded admin account:', adminEmail);
  }
  if ((await Event.countDocuments()) === 0) {
    await Event.insertMany([
      { name: 'RSU Intramurals 2026',        date: new Date('2026-11-20'), venue: 'RSU Gymnasium', description: 'Join the RSU intramurals and show your school spirit!' },
      { name: 'Seminar on Digital Skills',   date: new Date('2026-11-25'), venue: 'AVR',           description: 'Learn essential digital skills for the modern workplace.' },
      { name: 'Arts and Culture Fest',       date: new Date('2026-11-30'), venue: 'RSU Grounds',   description: 'Celebrate creativity and campus culture at RSU.' }
    ]);
    console.log('Seeded 3 sample events');
  }
}

const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rsu_events')
  .then(async () => {
    await seed();
    app.listen(PORT, () =>
      console.log(`RSU Event Registration server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
