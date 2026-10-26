import { API_BASE_URL } from './api';

function parseEvent(message) {
  const lines = message.replace(/\r\n/g, '\n').split('\n');
  const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message';
  const data = lines
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).replace(/^ /, ''))
    .join('\n');
  return { event, data };
}

export async function streamAnswer({ token, payload, onEvent, signal }) {
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (!response.body) throw new Error('Streaming is not supported by this browser.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const message = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (message.trim()) onEvent(parseEvent(message));
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }

  if (buffer.trim()) onEvent(parseEvent(buffer));
}

