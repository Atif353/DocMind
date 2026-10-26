function parseSseData(message) {
  return message
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).replace(/^ /, ''))
    .join('\n');
}

function writeSse(res, data, event) {
  if (event) res.write(`event: ${event}\n`);
  for (const line of String(data).split('\n')) res.write(`data: ${line}\n`);
  res.write('\n');
}

module.exports = { parseSseData, writeSse };

