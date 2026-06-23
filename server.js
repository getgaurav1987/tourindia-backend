const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3001;

function proxyRequest(options, body, res) {
  const req = http.request(options, (r) => {
    let data = '';
    r.on('data', (c) => data += c);
    r.on('end', () => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      try { res.end(data); }
      catch(e) { res.end(JSON.stringify({error: e.message})); }
    });
  });
  req.on('error', (e) => {
    res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({Status:2, Error:{ErrorMessage: e.message}}));
  });
  req.setTimeout(90000, () => {
    req.destroy();
    res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({Status:2, Error:{ErrorMessage:'Timeout'}}));
  });
  if (body) req.write(body);
  req.end();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok',project:'Tour India Backend',time:new Date().toISOString()}));
    return;
  }

  let body = '';
  req.on('data', (c) => body += c);
  req.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body || '{}'); } catch(e) {}

    if (req.url === '/api/tbo-auth') {
      const payload = JSON.stringify({
        ClientId: 'ApiIntegrationNew',
        UserName: parsed.UserName || process.env.TBO_USERNAME || 'TourI',
        Password: parsed.Password || process.env.TBO_PASSWORD || 'TourI@123',
        EndUserIp: '103.24.81.1'
      });
      proxyRequest({
        hostname: 'Sharedapi.tektravels.com',
        path: '/SharedData.svc/rest/Authenticate',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}
      }, payload, res);
    }

    else if (req.url === '/api/tbo-flights') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/Search',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else if (req.url === '/api/tbo-farequote') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/FareQuote',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else if (req.url === '/api/tbo-book') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/Book',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else if (req.url === '/api/tbo-ticket') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/Ticket',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else if (req.url === '/api/tbo-hotels') {
      proxyRequest({
        hostname: 'api.tbotechnology.in',
        path: '/hotelapi_v7/hotelservice.svc/Search',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'Not found'}));
    }
  });
});

server.listen(PORT, () => {
  console.log('Tour India backend running on port ' + PORT);
});
