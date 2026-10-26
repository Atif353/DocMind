const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value, { name, min = 1, max = 1000 } = {}) {
  if (typeof value !== 'string') {
    throw Object.assign(new Error(`${name} must be a string.`), { status: 400 });
  }
  const clean = value.trim();
  if (clean.length < min || clean.length > max) {
    throw Object.assign(new Error(`${name} must contain between ${min} and ${max} characters.`), { status: 400 });
  }
  return clean;
}

function emailAddress(value) {
  const email = cleanString(value, { name: 'Email', max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
  }
  return email;
}

function uuid(value, name = 'Identifier') {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw Object.assign(new Error(`${name} is invalid.`), { status: 400 });
  }
  return value;
}

function passwordValue(value, minimum = 10) {
  if (typeof value !== 'string' || value.length < minimum || Buffer.byteLength(value, 'utf8') > 72) {
    throw Object.assign(new Error(`Password must contain at least ${minimum} characters and at most 72 UTF-8 bytes.`), { status: 400 });
  }
  return value;
}

module.exports = { cleanString, emailAddress, uuid, passwordValue };

