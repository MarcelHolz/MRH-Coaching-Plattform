import Stripe from 'stripe'
import dns from 'node:dns'

// Node 18+ can prefer an IPv6 route when the DNS answer offers one, and on
// some serverless/cloud network paths that route is silently broken while
// IPv4 works fine -- a well-known cause of "StripeConnectionError, request
// was retried N times" failures that reproduce every time. Forcing IPv4
// first avoids that class of failure; harmless where IPv6 was fine anyway.
dns.setDefaultResultOrder('ipv4first')

let client = null

export function getStripe() {
  if (client) return client

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY muss serverseitig gesetzt sein.')
  }

  client = new Stripe(secretKey, {
    timeout: 20000,
    maxNetworkRetries: 2,
  })

  return client
}
