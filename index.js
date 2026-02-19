const { Pear } = require('pear-runtime');
const { Hyperswarm } = require('hyperswarm');
const { HyperDHT } = require('hyper-dht');
const Protomux = require('protomux');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { randomBytes } = require('crypto');
const Autobase = require('autobase'); // Asumsi dari contract/
const Hyperbee = require('hyperbee'); // Asumsi dari contract/

// Helper dari features/ (asumsi existing, extend jika perlu)
const { welcomePolicy, ownerOnlyWritePolicy, invitesPolicy, powPolicy, relayPolicy } = require('./features/policies');

// Setup app
const app = new Pear({
  peerStoreName: process.argv['peer-store-name'] || 'intercom-peer',
  msbStoreName: process.argv['msb-store-name'] || 'intercom-msb',
  subnetChannel: process.argv['subnet-channel'] || null,
  subnetBootstrap: process.argv['subnet-bootstrap'] ? process.argv['subnet-bootstrap'].split(',') : null,
  sidechannels: process.argv['sidechannels'] ? process.argv['sidechannels'].split(',') : [],
  sidechannelPolicy: process.argv['sidechannel-policy'] ? parsePolicy(process.argv['sidechannel-policy']) : {},
  relay: process.argv['relay'] || false
});

// Swarm setup
const swarm = new Hyperswarm();
swarm.join(new Buffer.from('0000intercom', 'hex')); // Entry sidechannel

// Tambah sidechannels custom
app.sidechannels.forEach(channel => {
  const key = new Buffer.from(channel, 'hex'); // Asumsi hash simple
  swarm.join(key);
  // Apply policy
  if (app.sidechannelPolicy[channel]) {
    applyPolicy(channel, app.sidechannelPolicy[channel]);
  }
});

// Contract setup (Autobase/Hyperbee untuk state swap)
let contractDb;
async function setupContract() {
  const autobase = new Autobase(swarm); // Extend dari contract/
  contractDb = new Hyperbee(autobase, { keyEncoding: 'utf-8', valueEncoding: 'json' });
  await contractDb.ready();
}
setupContract();

// MSB client (untuk settlement)
const msbClient = app.msbStoreName ? require('msb-client')(app.msbStoreName) : null; // Asumsi lib MSB

// SC-Bridge WebSocket
const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let authenticated = false;
  ws.on('message', async (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'auth') {
      // Simple auth (extend buat real)
      if (msg.token === 'dummy_token') { // Ganti real auth
        authenticated = true;
        ws.send(JSON.stringify({ status: 'authenticated' }));
      }
      return;
    }
    if (!authenticated) return ws.send(JSON.stringify({ error: 'unauth' }));

    switch (msg.type) {
      // Existing commands (asumsi dari upstream)
      case 'send':
        sendToSidechannel(msg.channel, msg.payload);
        break;
      case 'join':
        joinSidechannel(ws, msg.channel, msg.invite);
        break;
      case 'stats':
        ws.send(JSON.stringify({ stats: getStats() }));
        break;

      // Custom Swap Commands
      case 'init_swap': {
        const swapId = randomBytes(16).toString('hex');
        const payload = { ...msg, swapId, status: 'pending' };
        await contractDb.put(`swap:${swapId}`, payload); // Simpan state
        sendToSidechannel('swap-chan', payload); // Broadcast proposal
        ws.send(JSON.stringify({ status: 'initiated', swapId }));
        break;
      }
      case 'confirm_swap': {
        const swap = await contractDb.get(`swap:${msg.swapId}`);
        if (swap && swap.value.status === 'pending') {
          // Validate signature (extend buat real ECDSA/EdDSA)
          const updated = { ...swap.value, status: 'confirmed', signature: msg.signature };
          await contractDb.put(`swap:${msg.swapId}`, updated);
          sendToSidechannel('swap-chan', updated);
          ws.send(JSON.stringify({ status: 'confirmed' }));
        }
        break;
      }
      case 'settle_swap': {
        const swap = await contractDb.get(`swap:${msg.swapId}`);
        if (swap && swap.value.status === 'confirmed') {
          // Settle via MSB (asumsi external TX)
          if (msbClient) {
            const tx = await msbClient.settle({ from: swap.value.from, to: swap.value.to, amount: swap.value.amount, txHash: msg.txHash });
            const finalized = { ...swap.value, status: 'settled', tx };
            await contractDb.put(`swap:${msg.swapId}`, finalized);
            sendToSidechannel('swap-chan', finalized);
            ws.send(JSON.stringify({ status: 'settled', tx }));
          }
        }
        break;
      }
      default:
        ws.send(JSON.stringify({ error: 'unknown_command' }));
    }
  });
});

server.listen(3000, () => console.log('SC-Bridge on ws://localhost:3000'));

// Helper functions (extend dari upstream)
function sendToSidechannel(channel, payload) {
  // Logic broadcast via swarm/Protomux
  console.log(`Sent to ${channel}: ${JSON.stringify(payload)}`);
  // Real impl: protomux.message(...)
}

function joinSidechannel(ws, channel, invite) {
  // Check policy, join swarm key
  if (app.sidechannelPolicy[channel] === 'invites' && validateInvite(invite)) {
    console.log(`Joined ${channel}`);
  }
}

function applyPolicy(channel, policy) {
  // Dari features/
  if (policy === 'invites') invitesPolicy(channel);
  // etc.
}

function parsePolicy(str) {
  // Parse flag seperti swap-chan=invites
  const policies = {};
  str.split(',').forEach(p => {
    const [chan, pol] = p.split('=');
    policies[chan] = pol;
  });
  return policies;
}

function validateInvite(invite) {
  return true; // Extend real validation
}

function getStats() {
  return { peers: swarm.peers.length }; // Example
}

// Handle process
process.on('SIGINT', () => {
  swarm.destroy();
  server.close();
  process.exit(0);
});
