const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { asyncHandler, HttpError } = require('../middleware/errors');
const { cleanString, emailAddress, passwordValue } = require('../lib/validation');

function createAuthRouter({ config, supabase, authenticate }) {
  const router = express.Router();

  router.post('/register', asyncHandler(async (req, res) => {
    const email = emailAddress(req.body.email);
    const password = passwordValue(req.body?.password);
    const name = cleanString(req.body.name, { name: 'Name', min: 2, max: 120 });

    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existingUser) throw new HttpError(409, 'An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const role = config.bootstrapAdminEmails.has(email) ? 'admin' : 'editor';
    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, password_hash: passwordHash, name, role })
      .select('id, email, name, role, created_at')
      .single();

    if (error?.code === '23505') throw new HttpError(409, 'An account with this email already exists.');
    if (error) throw error;
    res.status(201).json({ message: 'Account created.', user });
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const email = emailAddress(req.body.email);
    const password = passwordValue(req.body?.password, 1);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, password_hash')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    const valid = user && await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new HttpError(401, 'The email or password is incorrect.');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: config.jwtExpiresIn,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        subject: user.id
      }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  }));

  router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) throw new HttpError(404, 'User profile not found.');
    res.json(user);
  }));

  return router;
}

module.exports = { createAuthRouter };

