import type { MetadataRoute } from 'next';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_CONFIG.APP_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${APP_CONFIG.APP_URL}/book`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${APP_CONFIG.APP_URL}/credits`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ];
}
