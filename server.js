const http = require('http');
const https = require('https');
const crypto = require('crypto');

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

    else if (req.url === '/api/tbo-farerule') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/FareRule',
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

    else if (req.url === '/api/tbo-getbookingdetails') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/GetBookingDetails',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else if (req.url === '/api/tbo-hotel-cities') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/SharedServices/SharedData.svc/rest/GetDestinationSearchStaticData',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else if (req.url === '/api/tbo-hotel-search') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Hotel/hotelservice.svc/rest/GetHotelResult',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else if (req.url === '/api/razorpay-order') {
      var rzKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_T51oAAOB5yBJOe';
      var rzKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
      if (!rzKeySecret) {
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:'Razorpay secret not configured on server. Add RAZORPAY_KEY_SECRET in Render environment.'}));
        return;
      }
      var amountRupees = parseFloat(parsed.amount) || 0;
      if (amountRupees <= 0) {
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:'Invalid amount'}));
        return;
      }
      var orderBody = JSON.stringify({
        amount: Math.round(amountRupees * 100),
        currency: 'INR',
        receipt: 'wallet_' + Date.now()
      });
      var rzAuth = Buffer.from(rzKeyId + ':' + rzKeySecret).toString('base64');
      var rzReq = https.request({
        hostname: 'api.razorpay.com',
        path: '/v1/orders',
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'Authorization':'Basic ' + rzAuth,
          'Content-Length': Buffer.byteLength(orderBody)
        }
      }, function(rzRes){
        var d = '';
        rzRes.on('data', function(c){ d += c; });
        rzRes.on('end', function(){
          res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
          res.end(d);
        });
      });
      rzReq.on('error', function(e){
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:e.message}));
      });
      rzReq.setTimeout(30000, function(){
        rzReq.destroy();
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:'Razorpay timeout'}));
      });
      rzReq.write(orderBody);
      rzReq.end();
    }

    else if (req.url === '/api/razorpay-verify') {
      var vSecret = process.env.RAZORPAY_KEY_SECRET || '';
      var oid = parsed.razorpay_order_id || '';
      var pid = parsed.razorpay_payment_id || '';
      var sig = parsed.razorpay_signature || '';
      var expected = crypto.createHmac('sha256', vSecret).update(oid + '|' + pid).digest('hex');
      var valid = (vSecret && expected === sig);
      res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
      res.end(JSON.stringify({valid: valid, paymentId: pid, orderId: oid}));
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
