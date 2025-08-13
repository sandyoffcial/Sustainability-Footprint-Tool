import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(session({ secret: 'carbon_secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/carbontracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const UserSchema = new mongoose.Schema({
  googleId: String,
  email: String,
  name: String,
  groupId: String,
  groupName: String,
  data: Object, // {formSubmissions, badges, goals, history}
  history: [Object], // [{date, form, total, breakdown}]
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  badges: [String],
  lastSubmission: Date
});
const User = mongoose.model('User', UserSchema);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => User.findById(id).then(user => done(null, user)));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    user = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      data: {},
      history: [],
      points: 0,
      streak: 0,
      badges: [],
      lastSubmission: null
    });
  }
  return done(null, user);
}));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback: serve index.html for any unknown route (except API)
app.get(/^\/(?!api|auth).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Location-based recommendations (weather, transport)
app.post('/api/location-recommendations', async (req, res) => {
  const { lat, lon } = req.body;
  let weather = null, transport = null, recs = [];
  try {
    if (process.env.OPENWEATHER_API_KEY && lat && lon) {
      const wres = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
      weather = wres.data;
      if (weather && weather.main && weather.main.temp > 15 && weather.weather[0].main !== 'Rain') {
        recs.push('It’s a great day for walking or cycling!');
      } else if (weather && weather.weather[0].main === 'Rain') {
        recs.push('Consider public transport or carpooling due to rainy weather.');
      }
    }
  } catch (e) {
    recs.push('Could not fetch local recommendations.');
  }
  res.json({ weather, transport, recommendations: recs });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

app.get('/api/user', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

// Save user data, update history, points, streaks, badges
app.post('/api/save', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { data } = req.body;
  req.user.data = data;
  if (data && data.formSubmissions) {
    const today = new Date().toISOString().slice(0, 10);
    const last = req.user.history.length ? req.user.history[req.user.history.length - 1] : null;
    if (!last || last.date !== today) {
      req.user.history.push({
        date: today,
        form: data.formSubmissions,
        total: data.formSubmissions.total,
        breakdown: data.formSubmissions.breakdown
      });
      if (last && new Date(today) - new Date(last.date) === 86400000) {
        req.user.streak = (req.user.streak || 0) + 1;
      } else {
        req.user.streak = 1;
      }
      req.user.lastSubmission = today;
      req.user.points = (req.user.points || 0) + 10;
    }
  }
  await req.user.save();
  res.json({ success: true });
});

app.get('/api/load', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ data: req.user.data });
});

// Leaderboard (top 10 by points)
app.get('/api/leaderboard', async (req, res) => {
  const users = await User.find().sort({ points: -1 }).limit(10).select('name points streak');
  res.json({ leaderboard: users });
});

// AI Recommendations (OpenAI or fallback)
app.post('/api/recommendations', async (req, res) => {
  const { history } = req.body;
  let aiText = '';
  try {
    if (process.env.OPENAI_API_KEY) {
      const openaiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a sustainability coach. Give actionable, positive, and specific advice for reducing carbon footprint based on the user\'s data and trends.' },
          { role: 'user', content: `Here is my recent carbon footprint data: ${JSON.stringify(history)}. What are the top 3 things I should focus on next week?` }
        ]
      }, {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
      });
      aiText = openaiRes.data.choices[0].message.content;
    } else {
      aiText = 'Try to reduce car travel, eat more vegetarian meals, and buy fewer new items next week!';
    }
  } catch (e) {
    aiText = 'Try to reduce car travel, eat more vegetarian meals, and buy fewer new items next week!';
  }
  res.json({ recommendations: aiText });
});

// AI Natural Language Summary
app.post('/api/summary', async (req, res) => {
  const { history } = req.body;
  let aiText = '';
  try {
    if (process.env.OPENAI_API_KEY) {
      const openaiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a sustainability coach. Write a short, friendly summary of the user\'s carbon footprint trends over time.' },
          { role: 'user', content: `Here is my carbon footprint history: ${JSON.stringify(history)}. Summarise my progress and trends.` }
        ]
      }, {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
      });
      aiText = openaiRes.data.choices[0].message.content;
    } else {
      aiText = 'Your carbon footprint is steady. Keep up the good work and try to improve your travel and diet habits!';
    }
  } catch (e) {
    aiText = 'Your carbon footprint is steady. Keep up the good work and try to improve your travel and diet habits!';
  }
  res.json({ summary: aiText });
});

// Group/family support (create/join group, get group data)
app.post('/api/group', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { groupId, groupName } = req.body;
  req.user.groupId = groupId;
  req.user.groupName = groupName;
  await req.user.save();
  res.json({ success: true });
});
app.get('/api/group', async (req, res) => {
  if (!req.user || !req.user.groupId) return res.json({ group: null });
  const groupUsers = await User.find({ groupId: req.user.groupId }).select('name points streak history');
  res.json({ group: { name: req.user.groupName, users: groupUsers } });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('Server running on port', PORT));
