# Stripe Webhooks Recommendations

This document summarizes best practices for handling Stripe webhooks, especially within a Next.js application.

## 1. Webhook Signature Verification

To ensure that incoming webhook requests are genuinely from Stripe, you must verify their signatures.

### Pattern for Next.js Route Handlers (App Router)

```typescript
// app/api/webhooks/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Stripe signature missing' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      endpointSecret
    );
  } catch (err: any) {
    console.log(`⚠️ Webhook signature verification failed.`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
      // ... handle payment intent
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
```

**Key Points:**
-   **Disable Body Parser**: You need the raw request body for signature verification. In Next.js Pages Router, you would export `config = { api: { bodyParser: false } }`. The App Router handles this by default when you read the body with `req.text()`.
-   **Use `req.text()`**: This gives you the raw body as a string.
-   **Get Signature**: Retrieve the signature from the `stripe-signature` header.
-   **Construct Event**: Pass the raw body, signature, and your webhook secret to `stripe.webhooks.constructEvent`.

---

## 2. Local Webhook Testing with Stripe CLI

The Stripe CLI is the recommended way to test your webhook integration locally.

1.  **Install & Login**:
    ```bash
    # Install via your preferred package manager (e.g., Homebrew)
    brew install stripe/stripe-cli/stripe
    # Log in to your Stripe account
    stripe login
    ```

2.  **Forward Events**:
    ```bash
    # Forward webhook events to your local server
    stripe listen --forward-to localhost:3000/api/webhooks
    ```
    The CLI will provide a webhook signing secret (`whsec_...`) for your local testing. Use this in your `.env.local`.

3.  **Trigger Test Events**:
    ```bash
    # Trigger a specific event
    stripe trigger payment_intent.succeeded

    # See all available events
    stripe trigger --help
    ```

---

## 3. Source of Truth for Checkout Events

When using Stripe Checkout, use these events as the source of truth for order fulfillment.

-   **Payment Success**: `checkout.session.completed`
    -   This is the most reliable event to confirm a successful payment via Checkout.
-   **Payment Failure / Abandonment**: `checkout.session.expired`
    -   Fires when a Checkout Session expires without a successful payment.
-   **Refunds**: `charge.refunded`
    -   Indicates that a charge has been partially or fully refunded.

### Reading Your Internal Order ID

Pass your internal order ID or other identifiers to Stripe so you can reconcile orders when you receive a webhook.

-   **`metadata` (Recommended)**: Best for storing multiple key-value pairs.
    ```javascript
    // When creating the Checkout Session
    const session = await stripe.checkout.sessions.create({
      // ...
      metadata: {
        orderId: 'YOUR_INTERNAL_ORDER_ID',
        // ... other data
      },
    });

    // In the webhook handler for 'checkout.session.completed'
    const session = event.data.object;
    const orderId = session.metadata.orderId;
    ```

-   **`client_reference_id`**: Good for a single, simple identifier.
    ```javascript
    // When creating the Checkout Session
    const session = await stripe.checkout.sessions.create({
      // ...
      client_reference_id: 'YOUR_INTERNAL_ORDER_ID',
    });

    // In the webhook handler
    const session = event.data.object;
    const orderId = session.client_reference_id;
    ```

---

## 4. Handling Refunds

Refunds are asynchronous and can fail. It's best to listen to multiple events to track their status accurately.

-   **`charge.refunded`**:
    -   **Purpose**: The primary notification that a refund was *initiated* on a charge.
    -   **Use**: Good for quick updates, like marking an order as "refund processing" in your UI.

-   **`refund.updated`**:
    -   **Purpose**: Tracks the lifecycle of the `refund` object itself.
    -   **Use**: This is the source of truth for the refund's final status. The `status` property can be `succeeded`, `pending`, `failed`, or `canceled`.
    -   **Crucial for**: Detecting and handling failed refunds.

### Recommended Approach

Listen for **both** events.

1.  On `charge.refunded`, you know a refund process has started for a specific charge.
2.  On `refund.updated`, check the `status`. If it's `succeeded`, you can finalize the refund in your system. If it's `failed`, you can trigger a notification to your team to investigate.

```javascript
// In your webhook handler
switch (event.type) {
  case 'charge.refunded':
    const charge = event.data.object;
    console.log(`Refund initiated for charge: ${charge.id}`);
    // Optional: Update order status to 'refunding'
    break;

  case 'refund.updated':
    const refund = event.data.object;
    console.log(`Refund ${refund.id} status: ${refund.status}`);
    if (refund.status === 'succeeded') {
      // Finalize the refund in your database
      // Use refund.charge to link back to your order
    } else if (refund.status === 'failed') {
      // Alert your team to a failed refund
    }
    break;
}
```
