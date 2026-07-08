const http = require('http');
const https = require('https');
const crypto = require('crypto');
const HttpProxyAgent = require('http-proxy-agent').HttpProxyAgent;

const PORT = process.env.PORT || 3001;

// TBO certification: route ONLY TBO outbound calls through the Fixie proxy so they
// exit from a fixed, whitelisted IP. Read the proxy from FIXIE_URL (never hardcoded).
// If FIXIE_URL is not set, TBO calls fall back to going direct so local dev still works.
const FIXIE_URL = process.env.FIXIE_URL || '';
const tboProxyAgent = FIXIE_URL ? new HttpProxyAgent(FIXIE_URL) : null;
if (!tboProxyAgent) {
  console.warn('[TBO] FIXIE_URL not set - TBO API calls will go DIRECT (no fixed outbound IP). Set FIXIE_URL to route TBO through the Fixie proxy.');
}

function proxyRequest(options, body, res, timeoutMs) {
  // Route TBO calls through the Fixie proxy when configured; otherwise go direct.
  if (tboProxyAgent) options.agent = tboProxyAgent;
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
  req.setTimeout(timeoutMs || 90000, () => {
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
      var tboUser = parsed.UserName || process.env.TBO_USERNAME;
      var tboPass = parsed.Password || process.env.TBO_PASSWORD;
      if (!tboUser || !tboPass) {
        res.writeHead(500, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:'TBO credentials not configured on server. Set TBO_USERNAME and TBO_PASSWORD in the Render environment for tourindia-backend.'}));
        return;
      }
      const payload = JSON.stringify({
        ClientId: 'ApiIntegrationNew',
        UserName: tboUser,
        Password: tboPass,
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
      }, body, res, 300000);
    }

    else if (req.url === '/api/tbo-ticket') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/Ticket',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res, 300000);
    }

    else if (req.url === '/api/tbo-ssr') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/SSR',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res);
    }

    else if (req.url === '/api/passport-ocr') {
      var gKey = process.env.GEMINI_API_KEY || '';
      if (!gKey) {
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:'GEMINI_API_KEY not configured on server. Add it in the Render environment for tourindia-backend.'}));
        return;
      }
      var imgData = parsed.image || '';
      var mimeType = parsed.mimeType || 'image/jpeg';
      if (!imgData) {
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:'No image received'}));
        return;
      }
      var prompt = 'You are a passport data extractor. Read this passport image and, when present, use the machine-readable zone (the two lines of characters at the bottom) for accuracy. Return ONLY a JSON object (no markdown, no explanation) with exactly these keys: Title (one of Mr, Mrs, Ms, Mstr, Miss - infer from sex and age, default Mr), FirstName (given names as printed), LastName (surname as printed), Gender (single letter M or F), DateOfBirth (YYYY-MM-DD), Nationality (2-letter ISO country code), PassportNumber, PassportExpiry (YYYY-MM-DD), PassportIssueCountry (2-letter ISO country code). If any field is unreadable, use an empty string.';
      var gBody = JSON.stringify({
        contents: [{ parts: [ {text: prompt}, {inline_data: {mime_type: mimeType, data: imgData}} ] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      });
      var gReq = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-2.5-flash:generateContent?key=' + gKey,
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(gBody)}
      }, function(gRes){
        var d = '';
        gRes.on('data', function(c){ d += c; });
        gRes.on('end', function(){
          res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
          try {
            var j = JSON.parse(d);
            var txt = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text) || '';
            txt = txt.replace(/```json/g,'').replace(/```/g,'').trim();
            var fields = {};
            try { fields = JSON.parse(txt); } catch(e2) { fields = {}; }
            if (j.error) { res.end(JSON.stringify({error: (j.error.message || 'Gemini error')})); return; }
            res.end(JSON.stringify({ok:true, fields: fields}));
          } catch(e) {
            res.end(JSON.stringify({error:'Parse error', raw: String(d).substring(0,300)}));
          }
        });
      });
      gReq.on('error', function(e){
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:e.message}));
      });
      gReq.setTimeout(45000, function(){
        gReq.destroy();
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:'OCR timeout'}));
      });
      gReq.write(gBody);
      gReq.end();
    }

    else if (req.url === '/api/tbo-getbookingdetails') {
      proxyRequest({
        hostname: 'api.tektravels.com',
        path: '/BookingEngineService_Air/AirService.svc/rest/GetBookingDetails',
        method: 'POST',
        headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      }, body, res, 300000);
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
      var rzKeyId = process.env.RAZORPAY_KEY_ID;
      var rzKeySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!rzKeyId || !rzKeySecret) {
        res.writeHead(500, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:'Razorpay not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the Render environment.'}));
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