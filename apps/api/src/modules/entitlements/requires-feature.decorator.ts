import { SetMetadata } from '@nestjs/common';
import type { Feature } from './plan-catalog';

export const REQUIRES_FEATURE = 'requires_feature';

/** Marque un controller/handler comme exigeant une ou plusieurs capacités du plan. */
export const RequiresFeature = (...features: Feature[]) => SetMetadata(REQUIRES_FEATURE, features);
