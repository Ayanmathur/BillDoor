import { Metadata } from 'next';
import { fetchBillBySlugAction } from './actions';
import BillPageClient from './bill-page';
import './bill.css';

/**
 * Digital Bill Page — Server Component (§5.4)
 *
 * Public URL: /bill/[slug]
 * One link does three jobs: bill display + inline review + WhatsApp payload.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { bill, client } = await fetchBillBySlugAction(slug);
  return {
    title: client ? `Bill from ${client.business_name} — BillDoor` : 'Digital Bill — BillDoor',
    description: bill ? `Invoice ${bill.bill_number}` : 'View your digital bill',
  };
}

export default async function BillSlugPage({ params }: Props) {
  const { slug } = await params;
  const { bill, client, customer, loyaltyConfig, loyaltyProgress, error } = await fetchBillBySlugAction(slug);

  if (error === 'unavailable') {
    return (
      <div className="bill-page">
        <div style={{ textAlign: 'center', maxWidth: 360, padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Temporarily Unavailable</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: '#888' }}>This bill page is currently inactive.</p>
        </div>
      </div>
    );
  }

  if (!bill || !client) {
    return (
      <div className="bill-page">
        <div style={{ textAlign: 'center', maxWidth: 360, padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Bill Not Found</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: '#888' }}>This bill link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  return <BillPageClient 
    bill={bill} 
    client={client} 
    customer={customer} 
    loyaltyConfig={loyaltyConfig} 
    loyaltyProgress={loyaltyProgress} 
    status={bill.status}
    voidReason={bill.void_reason}
    hasGst={client.has_gst}
    gstNumber={client.gst_number}
  />;
}
