import { CatalogEvent, PlatformUrls } from '@/lib/types';
import { googleSearchFirstUrl } from '@/lib/google-search';

const PLATFORMS: { key: keyof PlatformUrls; domain: string }[] = [
  { key: 'stubhub',    domain: 'stubhub.com'    },
  { key: 'vividseats', domain: 'vividseats.com'  },
  { key: 'gametime',   domain: 'gametime.co'     },
  { key: 'tickpick',   domain: 'tickpick.com'    },
];

export async function searchPlatformUrls(
  event: CatalogEvent
): Promise<Pick<PlatformUrls, 'stubhub' | 'vividseats' | 'gametime' | 'tickpick'>> {
  const results = await Promise.all(
    PLATFORMS.map(({ domain }) => googleSearchFirstUrl(event, domain))
  );

  return {
    stubhub:    results[0],
    vividseats: results[1],
    gametime:   results[2],
    tickpick:   results[3],
  };
}
