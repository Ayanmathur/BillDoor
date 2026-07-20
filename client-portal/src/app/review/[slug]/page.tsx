import { Metadata } from 'next';
import { fetchClientBySlugAction } from './actions';
import ReviewPage from './review-page';

/**
 * Public Review Page — Server Component (§5.3)
 *
 * /review/[slug] — loads client by slug, renders ReviewPage.
 * Revoked clients get a neutral "temporarily unavailable" page.
 * No login required — this is the public QR/link destination.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { client } = await fetchClientBySlugAction(slug);
  return {
    title: client ? `Review ${client.business_name} — BillDoor` : 'Review — BillDoor',
    description: client ? `Share your experience with ${client.business_name}` : 'Share your review',
  };
}

export default async function ReviewSlugPage({ params }: Props) {
  const { slug } = await params;
  const { client, error } = await fetchClientBySlugAction(slug);

  if (error === 'temporarily_unavailable') {
    return (
      <div className="unavailable-page">
        <div className="unavailable-card">
          <h2>Temporarily Unavailable</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            This review page is currently inactive. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="unavailable-page">
        <div className="unavailable-card">
          <h2>Business Not Found</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            The review link you followed doesn&apos;t match any active business.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ReviewPage
      clientId={client.id}
      businessName={client.business_name}
      businessType={client.business_type || ''}
      about={client.about || ''}
      logoUrl={client.logo_url || ''}
      googlePlaceId={client.google_place_id || ''}
      rewardSettings={client.reward_settings || null}
    />
  );
}
